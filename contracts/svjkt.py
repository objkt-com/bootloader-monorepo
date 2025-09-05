import smartpy as sp
from smartpy.templates import fa2_lib as fa2
from utils import bytes_utils

# Main template for FA2 contracts
main = fa2.main


@sp.module
def svg_nft():
    import main
    import bytes_utils


    def log_2(n: sp.nat) -> sp.nat:
        j = 1
        c = 0
        while j < n:
            j *= 2
            c += 1
        return c
    
    def byte_to_nat(b: sp.bytes) -> sp.nat:
        n_bytes = len(b)
        bit_masks = [
            sp.bytes("0x01"),
            sp.bytes("0x02"),
            sp.bytes("0x04"),
            sp.bytes("0x08"),
            sp.bytes("0x10"),
            sp.bytes("0x20"),
            sp.bytes("0x40"),
            sp.bytes("0x80"),
        ]
        res = 0
        for i in range(n_bytes):
            byte = sp.slice(i, 1, b).unwrap_some()
            for bit_mask in bit_masks:
                if sp.and_bytes(byte, bit_mask) == bit_mask:
                    res = (res << 1) + 1
                else:
                    res = res << 1
        return res

    # Order of inheritance: [Admin], [<policy>], <base class>, [<other mixins>].
    class SVJKT(
        main.Admin,
        main.Nft,
        main.MintNft,
        main.BurnNft,
        main.OnchainviewBalanceOf,
    ):
        def __init__(self, admin_address, contract_metadata, ledger, token_metadata):
            main.OnchainviewBalanceOf.__init__(self)
            main.BurnNft.__init__(self)
            main.MintNft.__init__(self)
            main.Nft.__init__(self, contract_metadata, ledger, token_metadata)
            main.Admin.__init__(self, admin_address)
            self.data.next_token_id = 0
            self.data.next_generator_id = 0
            self.data.frags = sp.cast(sp.big_map({}), sp.big_map[sp.nat, sp.bytes])
            self.data.generator_mapping = sp.cast(sp.big_map({}), sp.big_map[sp.nat, sp.nat])
            self.data.generators = sp.cast(sp.big_map({}), sp.big_map[sp.nat, sp.record(
                name=sp.bytes,
                created=sp.timestamp,
                last_update=sp.timestamp,
                description=sp.bytes,
                author=sp.address, 
                royalty_address=sp.bytes,
                code=sp.bytes,
            )])

        @sp.entrypoint
        def create_generator(self, name, description, code, royalty_address):
            self.data.generators[self.data.next_generator_id] = sp.record(
                name=name,
                created = sp.now,
                last_update= sp.now,
                description=description,
                author=sp.sender,
                royalty_address=royalty_address,
                code=code,
            )
            self.data.next_generator_id += 1

        @sp.entrypoint
        def update_generator(self, generator_id, name, description, code, royalty_address):
            generator = self.data.generators[generator_id]
            assert sp.sender == generator.author, "NOT_AUTHOR"
            self.data.generators[self.data.next_generator_id] = sp.record(
                name=name,
                created=generator.created,
                last_update=sp.now,
                description=description,
                author=sp.sender,
                royalty_address=royalty_address,
                code=code,
            )

        @sp.entrypoint
        def add_fragment(self, frag_id: sp.nat, frag: sp.bytes):
            assert self.data.administrator == sp.sender
            self.data.frags[frag_id] = frag

        @sp.entrypoint
        def mint(self, generator_id: sp.nat, entropy: sp.bytes): 
            # Construct the artifactUri as a svg that is rendered on-chain
            # create a simple util in python to convert svg primitives into a
            # base64 buildable data uri. Start with something simple like circles
            # and squares of different sizes that are assembled on-chain)
            generator = self.data.generators[generator_id]
            svg_string =    self.data.frags[0] + \
                            bytes_utils.from_nat(byte_to_nat(entropy)) + \
                            self.data.frags[1] + \
                            generator.code + \
                            self.data.frags[2]

            self.data.ledger[self.data.next_token_id] = sp.sender
            self.data.token_metadata[self.data.next_token_id] = sp.record(
                token_id=self.data.next_token_id,
                token_info={
                    "name": generator.name + sp.bytes("0x2023") + bytes_utils.from_int(sp.to_int(self.data.next_token_id)),
                    "artifactUri": svg_string,
                    "royalties": sp.bytes("0x22726F79616C74696573223A7B22646563696D616C73223A322C22736861726573223A7B22") + generator.royalty_address + sp.bytes("0x223A357D7D") 
                }
            )
            self.data.generator_mapping[self.data.next_token_id] = generator_id
            self.data.next_token_id += 1

@sp.add_test()
def test():
    # Create and configure the test scenario
    # Import the types from the FA2 library, the library itself, and the contract module, in that order.
    scenario = sp.test_scenario("svjkt")

    # Define test accounts
    admin = sp.test_account("Admin")
    alice = sp.test_account("Alice")
    bob = sp.test_account("Bob")

    # Instantiate the FA2 NFT contract
    contract = svg_nft.SVJKT(
        admin.address, sp.big_map({}), {}, []
    )
    scenario += contract
    for i in range(4):
        contract.add_fragment(sp.record(frag_id=i, frag=sp.bytes("0x00")), _sender=admin.address)
    contract.create_generator(name=sp.bytes("0x"), description=sp.bytes("0x"), code=sp.bytes("0x00"), royalty_address=sp.bytes("0x00"), _sender=alice.address)
    import os
    for i in range(10):
        contract.mint(generator_id=0, entropy=sp.bytes("0x" + os.urandom(16).hex()), _sender=alice.address)