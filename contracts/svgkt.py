import smartpy as sp
from smartpy.templates import fa2_lib as fa2
from utils import bytes_utils

# Main template for FA2 contracts
main = fa2.main



@sp.module
def svgkt():
    import main
    import bytes_utils

    class EmptyContract(sp.Contract):
        def __init__(self):
            self.data = ()

    # Order of inheritance: [Admin], [<policy>], <base class>, [<other mixins>].
    class SvgKT(
        main.Admin,
        main.Nft,
        main.MintNft,
        main.BurnNft,
        main.OnchainviewBalanceOf,
    ):
        def __init__(self, admin_address, rng_contract, contract_metadata, ledger, token_metadata):
            main.OnchainviewBalanceOf.__init__(self)
            main.BurnNft.__init__(self)
            main.MintNft.__init__(self)
            main.Nft.__init__(self, contract_metadata, ledger, token_metadata)
            main.Admin.__init__(self, admin_address)
            self.data.next_token_id = 0
            self.data.next_generator_id = 0
            self.data.frags = sp.cast(sp.big_map({}), sp.big_map[sp.nat, sp.bytes])
            self.data.generator_mapping = sp.cast(sp.big_map({}), sp.big_map[sp.nat, sp.nat])
            self.data.treasury = admin_address
            self.data.platform_fee_bps = 2000
            self.data.rng_contract = rng_contract
            self.data.generators = sp.cast(sp.big_map({}), sp.big_map[sp.nat, sp.record(
                name=sp.bytes,
                created=sp.timestamp,
                last_update=sp.timestamp,
                description=sp.bytes,
                author=sp.address, 
                author_bytes=sp.bytes,
                code=sp.bytes,
                n_tokens=sp.nat,
                sale=sp.option[sp.record(
                    paused=sp.bool,
                    start_time=sp.option[sp.timestamp],
                    price=sp.mutez,
                    editions=sp.nat,
                )]
            )])

        @sp.entrypoint
        def create_generator(self, name, description, code, author_bytes):
            self.data.generators[self.data.next_generator_id] = sp.record(
                name=name,
                created = sp.now,
                last_update= sp.now,
                description=description,
                author=sp.sender,
                author_bytes=author_bytes,
                code=code,
                n_tokens=0,
                sale=None,
            )
            self.data.next_generator_id += 1

        @sp.entrypoint
        def update_generator(self, generator_id, name, description, code, author_bytes):
            generator = self.data.generators[generator_id]
            assert sp.sender == generator.author, "NOT_AUTHOR"
            self.data.generators[generator_id] = sp.record(
                name=name,
                created=generator.created,
                last_update=sp.now,
                description=description,
                author=sp.sender,
                author_bytes=author_bytes,
                code=code,
                n_tokens=generator.n_tokens,
                sale=generator.sale
            )
        
        @sp.entrypoint
        def set_sale(self, generator_id, start_time, price, paused, editions):
            generator = self.data.generators[generator_id]
            assert sp.sender == generator.author, "NOT_AUTHOR"
            # only allow reducing edition size
            match generator.sale:
                case Some(sale):
                    # but only if no tokens were minted yet
                    if generator.n_tokens > 0:
                        assert editions <= sale.editions, "NO_ED_INCREMENT"

            self.data.generators[generator_id].sale = sp.Some(sp.record(
                start_time=start_time,
                price=price,
                paused=paused,
                editions=editions
            ))
        
        @sp.entrypoint
        def set_treasury(self, address):
            assert self.data.administrator == sp.sender, "ONLY_ADMIN"
            self.data.treasury = address
        
        @sp.entrypoint
        def set_platform_fee_bps(self, platform_fee_bps):
            assert self.data.administrator == sp.sender, "ONLY_ADMIN"
            self.data.platform_fee_bps = platform_fee_bps

        @sp.entrypoint
        def add_fragment(self, frag_id: sp.nat, frag: sp.bytes):
            assert self.data.administrator == sp.sender, "ONLY_ADMIN"
            self.data.frags[frag_id] = frag
        
        @sp.entrypoint
        def airdrop(self, generator_id: sp.nat, recipient: sp.address, entropy: sp.bytes):
            generator = self.data.generators[generator_id]
            assert sp.sender == generator.author, "NOT_AUTHOR"
            sale = generator.sale.unwrap_some()
            assert generator.n_tokens < sale.editions, "SOLD_OUT"

            # get_entropy
            c = sp.create_contract_operation(EmptyContract, None, sp.mutez(0), ())
            e = sp.view("rb", self.data.rng_contract, entropy + sp.pack(c.address)+sp.pack(generator.n_tokens), sp.bytes).unwrap_some()
            sp.send(self.data.rng_contract, sp.mutez(0))


            # assemble NFT Metadata
            svg_string =    self.data.frags[0] + \
                            bytes_utils.from_nat(bytes_utils.to_nat(e)) + \
                            self.data.frags[1] + \
                            generator.code + \
                            self.data.frags[2]

            self.data.ledger[self.data.next_token_id] = recipient
            self.data.token_metadata[self.data.next_token_id] = sp.record(
                token_id=self.data.next_token_id,
                token_info={
                    "name": generator.name + sp.bytes("0x2023") + bytes_utils.from_nat(generator.n_tokens+1),
                    "artifactUri": svg_string,
                    "royalties": sp.bytes("0x7B22646563696D616C73223A322C22736861726573223A7B22") + generator.author_bytes + sp.bytes("0x223A357D7D"),
                    "creators": sp.bytes("0x5B22") + generator.author_bytes + sp.bytes('0x225D'),
                    "symbol": sp.bytes("0x53564A4B54"),
                    "decimals": sp.bytes("0x30"),
                }
            )
            self.data.generators[generator_id].n_tokens += 1
            self.data.generator_mapping[self.data.next_token_id] = generator_id
            self.data.next_token_id += 1

        @sp.entrypoint
        def mint(self, generator_id: sp.nat, entropy: sp.bytes): 
            generator = self.data.generators[generator_id]
            assert generator.sale.is_some(), "NO_SALE_CONFIG"
            sale = generator.sale.unwrap_some()
            assert not sale.paused, "SALE_PAUSED"
            assert sp.amount == sale.price, "PRICE_MISMATCH"
            match sale.start_time:
                case Some(start_time):
                    assert sp.now >= start_time, "SALE_NOT_STARTED"
            assert generator.n_tokens < sale.editions, "SOLD_OUT"

            # get_entropy
            c = sp.create_contract_operation(EmptyContract, None, sp.mutez(0), ())
            e = sp.view("rb", self.data.rng_contract, entropy + sp.pack(c.address)+sp.pack(generator.n_tokens), sp.bytes).unwrap_some()
            sp.send(self.data.rng_contract, sp.mutez(0))

            if sp.amount > sp.mutez(0):
                platform_fee = sp.split_tokens(sp.amount, self.data.platform_fee_bps, 10_000)
                rest = sp.amount - platform_fee
                if platform_fee > sp.mutez(0):
                    sp.send(self.data.treasury, platform_fee)
                if rest > sp.mutez(0):
                    sp.send(generator.author, rest)

            # assemble NFT Metadata
            svg_string =    self.data.frags[0] + \
                            bytes_utils.from_nat(bytes_utils.to_nat(e)) + \
                            self.data.frags[1] + \
                            generator.code + \
                            self.data.frags[2]

            self.data.ledger[self.data.next_token_id] = sp.sender
            self.data.token_metadata[self.data.next_token_id] = sp.record(
                token_id=self.data.next_token_id,
                token_info={
                    "name": generator.name + sp.bytes("0x2023") + bytes_utils.from_nat(generator.n_tokens+1),
                    "artifactUri": svg_string,
                    "royalties": sp.bytes("0x7B22646563696D616C73223A322C22736861726573223A7B22") + generator.author_bytes + sp.bytes("0x223A357D7D"),
                    "creators": sp.bytes("0x5B22") + generator.author_bytes + sp.bytes('0x225D'),
                    "symbol": sp.bytes("0x53564A4B54"),
                    "decimals": sp.bytes("0x30"),
                }
            )
            self.data.generators[generator_id].n_tokens += 1
            self.data.generator_mapping[self.data.next_token_id] = generator_id
            self.data.next_token_id += 1

@sp.add_test()
def test():
    # Create and configure the test scenario
    # Import the types from the FA2 library, the library itself, and the contract module, in that order.
    scenario = sp.test_scenario("svgkt")
    admin = sp.test_account("admin")
    contract = svgkt.SvgKT(
        admin.address, admin.address, sp.big_map({}), {}, []
    )
    scenario += contract
