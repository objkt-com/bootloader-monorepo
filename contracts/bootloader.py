import smartpy as sp
from smartpy.templates import fa2_lib as fa2
from utils import bytes_utils, list_utils

main = fa2.main

@sp.module  
def bootloader():
    import main
    import bytes_utils
    import list_utils

    class EmptyContract(sp.Contract):
        def __init__(self):
            self.data = ()
    
    t_lambda_params: type = sp.record(
        fragments=sp.list[sp.bytes],
        token_id=sp.nat,
        seed=sp.bytes,
        iteration_number=sp.nat,
        generator_name=sp.bytes,
        generator_author_bytes=sp.bytes,
        generator_version=sp.nat,
        generator_code=sp.bytes
    )
    t_lambda: type = sp.lambda_(t_lambda_params, sp.map[sp.string, sp.bytes])

    # Order of inheritance: [Admin], [<policy>], <base class>, [<other mixins>].
    class Bootloader(
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
            self.data.token_extra = sp.cast(sp.big_map({}), sp.big_map[sp.nat, sp.record(
                generator_id=sp.nat, 
                generator_version=sp.nat,
                seed=sp.bytes,
                iteration_number=sp.nat,
            )])
            self.data.treasury = admin_address
            self.data.platform_fee_bps = 2000
            self.data.rng_contract = rng_contract
            self.data.next_bootloader_id = 0
            self.data.moderators = sp.cast(sp.big_map({}), sp.big_map[sp.address, sp.unit])
            self.data.generator_mints = sp.cast(sp.big_map({}), sp.big_map[sp.pair[sp.nat, sp.address], sp.nat])
            self.data.bootloaders = sp.cast(sp.big_map({}), sp.big_map[sp.nat, sp.record(
                version=sp.bytes,
                fragments=sp.list[sp.bytes],
                fun=t_lambda,
            )])
            self.data.bootloader_storage_limits = sp.cast(sp.big_map({}), sp.big_map[sp.nat, sp.record(
                    code=sp.nat,
                    name=sp.nat,
                    desc=sp.nat,
                    author=sp.nat
                )
            ])
            self.data.generators = sp.cast(sp.big_map({}), sp.big_map[sp.nat, sp.record(
                name=sp.bytes,
                created=sp.timestamp,
                last_update=sp.timestamp,
                description=sp.bytes,
                author=sp.address, 
                author_bytes=sp.bytes,
                code=sp.bytes,
                n_tokens=sp.nat,
                reserved_editions=sp.nat,
                flag=sp.nat,
                version=sp.nat,
                type_id=sp.nat,
                sale=sp.option[sp.record(
                    paused=sp.bool,
                    start_time=sp.option[sp.timestamp],
                    price=sp.mutez,
                    editions=sp.nat,
                    max_per_wallet=sp.option[sp.nat],
                )]
            )])
        
        @sp.entrypoint
        def add_moderator(self, address:  sp.address):
            assert sp.sender == self.data.administrator, "ONLY_ADMIN"
            self.data.moderators[address] = ()
        
        @sp.entrypoint
        def remove_moderator(self, address: sp.address):
            assert sp.sender == self.data.administrator, "ONLY_ADMIN"
            del self.data.moderators[address]
        
        @sp.entrypoint
        def add_bootloader(self, version: sp.bytes, fragments: sp.list[sp.bytes], fun: t_lambda, storage_limits):
            assert sp.sender == self.data.administrator, "ONLY_ADMIN"
            self.data.bootloaders[self.data.next_bootloader_id] = sp.record(version=version, fragments=fragments, fun=fun)
            self.data.bootloader_storage_limits[self.data.next_bootloader_id] = storage_limits
            self.data.next_bootloader_id += 1
        


        @sp.entrypoint
        def create_generator(self, name: sp.bytes, description: sp.bytes, code: sp.bytes, author_bytes: sp.bytes, reserved_editions: sp.nat, bootloader_id: sp.nat):
            assert self.data.bootloaders.contains(bootloader_id), "UNKOWN_bootloader"
            storage_limits = self.data.bootloader_storage_limits[bootloader_id]
            assert sp.len(name) <= storage_limits.name, "NAME_TOO_LONG"
            assert sp.len(description) <= storage_limits.desc, "DESC_TOO_LONG"
            assert sp.len(code) <= storage_limits.code, "CODE_TOO_LONG"
            assert sp.len(author_bytes) <= storage_limits.author, "AUTHOR_TOO_LONG"

            self.data.generators[self.data.next_generator_id] = sp.record(
                name=name,
                created = sp.now,
                last_update= sp.now,
                description=description,
                author=sp.sender,
                author_bytes=author_bytes,
                code=code,
                n_tokens=0,
                reserved_editions=reserved_editions,
                flag=0,
                version=1,
                type_id=bootloader_id,
                sale=None,
            )

            self.data.next_generator_id += 1

        @sp.entrypoint
        def update_generator(self, generator_id: sp.nat, name: sp.bytes, description: sp.bytes, code: sp.bytes, author_bytes: sp.bytes, reserved_editions: sp.nat):
            generator = self.data.generators[generator_id]
            assert sp.sender == generator.author, "ONLY_AUTHOR"

            storage_limits = self.data.bootloader_storage_limits[generator.type_id]
            assert sp.len(name) <= storage_limits.name, "NAME_TOO_LONG"
            assert sp.len(description) <= storage_limits.desc, "DESC_TOO_LONG"
            assert sp.len(code) <= storage_limits.code, "CODE_TOO_LONG"
            assert sp.len(author_bytes) <= storage_limits.author, "AUTHOR_TOO_LONG"

            # if geneartor has sale configured. Ensure reserved_editions are not more than remaining capacity
            match generator.sale:
                case Some(sale):
                    assert generator.n_tokens + reserved_editions <= sale.editions, "RESERVE_EXCEEDS_CAPACITY"

            self.data.generators[generator_id] = sp.record(
                name=name,
                created=generator.created,
                last_update=sp.now,
                description=description,
                author=sp.sender,
                author_bytes=author_bytes,
                code=code,
                n_tokens=generator.n_tokens,
                reserved_editions=reserved_editions,
                flag=generator.flag,
                sale=generator.sale,
                type_id=generator.type_id,
                version=generator.version +1,
            )
        
        @sp.entrypoint
        def delete_generator(self, generator_id: sp.nat):
            generator = self.data.generators[generator_id]
            assert sp.sender == generator.author, "ONLY_AUTHOR"
            assert generator.n_tokens == 0, "TOKENS_MINTED"
            del self.data.generators[generator_id]

        @sp.entrypoint
        def set_rng_contract(self, rng: sp.address):
            assert self.data.moderators.contains(sp.sender) or sp.sender == self.data.administrator, "ONLY_MODS"
            self.data.rng_contract = rng
        
        @sp.entrypoint
        def flag_generator(self, generator_id: sp.nat, flag: sp.nat):
            # used for UI moderation
            assert self.data.moderators.contains(sp.sender) or sp.sender == self.data.administrator, "ONLY_MODS"
            self.data.generators[generator_id].flag = flag

        @sp.entrypoint
        def update_thumbnail(self, token_id: sp.nat, thumbnailUri: sp.bytes):
            token_extra = self.data.token_extra[token_id]
            generator = self.data.generators[token_extra.generator_id]
            assert sp.sender == generator.author or self.data.moderators.contains(sp.sender) or sp.sender == self.data.administrator, "ONLY_AUTHOR_OR_MODS"
            current_metadata = self.data.token_metadata[token_id].token_info
            current_metadata['thumbnailUri'] = thumbnailUri
            self.data.token_metadata[token_id] = sp.record(token_id=token_id, token_info=current_metadata)
        
        @sp.entrypoint
        def set_sale(self, generator_id: sp.nat, start_time: sp.option[sp.timestamp], price: sp.mutez, paused: sp.bool, editions: sp.nat, max_per_wallet: sp.option[sp.nat]):
            generator = self.data.generators[generator_id]
            assert sp.sender == generator.author, "ONLY_AUTHOR"
            # only allow reducing edition size
            match generator.sale:
                case Some(sale):
                    # but only if no tokens were minted yet
                    if generator.n_tokens > 0:
                        assert editions <= sale.editions, "NO_ED_INCREMENT"
            assert editions >= generator.n_tokens + generator.reserved_editions, "ED_LT_MINTED"
            self.data.generators[generator_id].sale = sp.Some(sp.record(
                start_time=start_time,
                price=price,
                paused=paused,
                editions=editions,
                max_per_wallet=max_per_wallet,
            ))
        
        @sp.entrypoint
        def set_treasury(self, address: sp.address):
            assert self.data.moderators.contains(sp.sender) or sp.sender == self.data.administrator, "ONLY_MODS"
            self.data.treasury = address
        
        @sp.entrypoint
        def set_platform_fee_bps(self, platform_fee_bps: sp.nat):
            assert self.data.moderators.contains(sp.sender) or sp.sender == self.data.administrator, "ONLY_MODS"
            sp.cast(platform_fee_bps, sp.nat)
            assert platform_fee_bps <= 10_000, "BPS_TOO_HIGH"
            self.data.platform_fee_bps = platform_fee_bps
        
        @sp.entrypoint
        def regenerate_token(self, token_id: sp.nat):
            assert self.data.ledger[token_id] == sp.sender, "ONLY_OWNER"
            token_extra = self.data.token_extra[token_id]
            generator = self.data.generators[token_extra.generator_id]
            assert generator.version > token_extra.generator_version, "NO_UPDATE_POSSIBLE"
            self.data.token_metadata[token_id] = sp.record(
                token_id=token_id, 
                token_info=self.data.bootloaders[generator.type_id].fun(sp.record(
                    fragments=self.data.bootloaders[generator.type_id].fragments,
                    token_id=token_id,
                    seed=token_extra.seed,
                    iteration_number=token_extra.iteration_number,
                    generator_name=generator.name,
                    generator_author_bytes=generator.author_bytes,
                    generator_version=generator.version,
                    generator_code=generator.code
            )))

            self.data.token_extra[token_id].generator_version = generator.version
        
        @sp.entrypoint
        def airdrop(self, generator_id: sp.nat, recipient: sp.address, entropy: sp.bytes):
            generator = self.data.generators[generator_id]
            assert sp.sender == generator.author, "ONLY_AUTHOR"
            assert generator.reserved_editions > 0, "NO_RESERVED_LEFT"
            match generator.sale:
                case Some(sale):
                    assert generator.n_tokens < sale.editions, "NO_RESERVED_LEFT"

            self.data.generators[generator_id].reserved_editions = sp.as_nat(generator.reserved_editions - 1)
            # get_entropy
            c = sp.create_contract_operation(EmptyContract, None, sp.mutez(0), ())
            e = sp.view("rb", self.data.rng_contract, sp.sha256(entropy + sp.pack(c.address)+sp.pack(generator.n_tokens)), sp.bytes).unwrap_some()
            sp.send(self.data.rng_contract, sp.mutez(0))

            seed = bytes_utils.from_nat(bytes_utils.to_nat(e))
            token_id = self.data.next_token_id

            self.data.token_metadata[token_id] = sp.record(
                token_id=token_id, 
                token_info=self.data.bootloaders[generator.type_id].fun(sp.record(
                fragments=self.data.bootloaders[generator.type_id].fragments,
                    token_id=token_id,
                    seed=seed,
                    iteration_number=generator.n_tokens+1,
                    generator_name=generator.name,
                    generator_author_bytes=generator.author_bytes,
                    generator_version=generator.version,
                    generator_code=generator.code
            )))


            self.data.ledger[token_id] = recipient
            self.data.generators[generator_id].n_tokens += 1
            self.data.token_extra[token_id] = sp.record(generator_id=generator_id, seed=seed, generator_version=generator.version, iteration_number=generator.n_tokens+1)
            self.data.next_token_id += 1

        @sp.entrypoint
        def mint(self, generator_id: sp.nat, entropy: sp.bytes): 
            generator = self.data.generators[generator_id]
            assert generator.sale.is_some(), "NO_SALE_CONFIG"
            match generator.sale:
                case Some(sale):
                    assert not sale.paused, "SALE_PAUSED"
                    assert sp.amount == sale.price, "PRICE_MISMATCH"

                    match sale.start_time:
                        case Some(start_time):
                            assert sp.now >= start_time, "SALE_NOT_STARTED"
                    
                    assert generator.n_tokens + generator.reserved_editions < sale.editions, "PUBLIC_SOLD_OUT"
                    
                    # enforce (optional) max per wallet
                    minted_key = (generator_id, sp.sender)
                    n_minted = self.data.generator_mints.get(minted_key, default=0)
                    match sale.max_per_wallet:
                        case Some(max_per_wallet):
                            assert max_per_wallet > n_minted, "EXCEEDS_MAX_PER_WALLET"
                    self.data.generator_mints[minted_key] = n_minted + 1


                    if sp.amount > sp.mutez(0):
                        platform_fee = sp.split_tokens(sp.amount, self.data.platform_fee_bps, 10_000)
                        rest = sp.amount - platform_fee
                        if platform_fee > sp.mutez(0):
                            sp.send(self.data.treasury, platform_fee)
                        if rest > sp.mutez(0):
                            sp.send(generator.author, rest)
                                        # get_entropy
                    c = sp.create_contract_operation(EmptyContract, None, sp.mutez(0), ())
                    e = sp.view("rb", self.data.rng_contract, sp.sha256(entropy + sp.pack(c.address)+sp.pack(generator.n_tokens)), sp.bytes).unwrap_some()
                    sp.send(self.data.rng_contract, sp.mutez(0))

                    seed = bytes_utils.from_nat(bytes_utils.to_nat(e))
                    token_id = self.data.next_token_id
                    self.data.token_metadata[token_id] = sp.record(
                        token_id=token_id, 
                        token_info=self.data.bootloaders[generator.type_id].fun(sp.record(
                        fragments=self.data.bootloaders[generator.type_id].fragments,
                            token_id=token_id,
                            seed=seed,
                            iteration_number=generator.n_tokens+1,
                            generator_name=generator.name,
                            generator_author_bytes=generator.author_bytes,
                            generator_version=generator.version,
                            generator_code=generator.code
                    )))

                    self.data.ledger[token_id] = sp.sender
                    self.data.generators[generator_id].n_tokens += 1
                    self.data.token_extra[token_id] = sp.record(generator_id=generator_id, seed=seed, generator_version=generator.version, iteration_number=generator.n_tokens+1)
                    self.data.next_token_id += 1
                case None:
                    raise "NO_SALE_CONFIGURED"
        
    class LambdaHelper(sp.Contract):
        def __init__(self, code):
            self.data = sp.cast(code, t_lambda)
        
    def v0_0_1(params):
        p = sp.cast(params, sp.record(
            fragments=sp.list[sp.bytes],
            token_id=sp.nat,
            seed=sp.bytes,
            iteration_number=sp.nat,
            generator_name=sp.bytes,
            generator_author_bytes=sp.bytes,
            generator_version=sp.nat,
            generator_code=sp.bytes
        ))
        svg_string =    list_utils.element_at((p.fragments, 0)) + \
                        p.seed + \
                        list_utils.element_at((p.fragments, 1)) + \
                        p.generator_code + \
                        list_utils.element_at((p.fragments, 2))

        iteration_bytes = bytes_utils.from_nat(p.iteration_number)
        token_id_bytes = bytes_utils.from_nat(p.token_id)
        thumbnail_uri_bytes = sp.bytes("0x68747470733A2F2F6D656469612E7376676B742E636F6D2F7468756D626E61696C2F") + token_id_bytes + sp.bytes("0x3F763D") + bytes_utils.from_nat(p.generator_version)
        return {
                "name": p.generator_name + sp.bytes("0x2023") + iteration_bytes,
                "artifactUri": svg_string,
                "thumbnailUri": thumbnail_uri_bytes, # cache buster for thumbnail generation
                "royalties": sp.bytes("0x7B22646563696D616C73223A322C22736861726573223A7B22") + p.generator_author_bytes + sp.bytes("0x223A357D7D"),
                "creators": sp.bytes("0x5B22") + p.generator_author_bytes + sp.bytes('0x225D'),
                "symbol": sp.bytes("0x53564A4B54"),
                "formats": sp.bytes("0x5B7B226D696D6554797065223A22696D6167652F6A706567222C22757269223A22") + thumbnail_uri_bytes + sp.bytes("0x227D5D"),
                "decimals": sp.bytes("0x30"),
        }

@sp.add_test()
def test():
    # Create and configure the test scenario
    # Import the types from the FA2 library, the library itself, and the contract module, in that order.
    scenario = sp.test_scenario("bootloader")
    admin = sp.test_account("admin")
    contract = bootloader.Bootloader(
        admin.address, admin.address, sp.big_map({}), {}, []
    )
    scenario += contract

@sp.add_test()
def test():
    scenario = sp.test_scenario("lambda_0_0_1")
    scenario += bootloader.LambdaHelper(bootloader.v0_0_1)

