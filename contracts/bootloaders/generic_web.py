import smartpy as sp
from smartpy.templates import fa2_lib as fa2

from contracts.utils import bytes_utils, list_utils

main = fa2.main


@sp.module
def generic_web():
    import bytes_utils
    import list_utils

    import main

    NULL_ADDRESS = sp.address("tz1Ke2h7sDdakHJQh8WX4Z372du1KChsksyU")
    # hex encoded "00"*32
    EMPTY_SEED = sp.bytes(
        "0xB00710ADE2B00710ADE2B00710ADE2B00710ADE2B00710ADE2B00710ADE21337"
    )

    _q = sp.bytes("0x3F")  # "?"
    _and = sp.bytes("0x26")  # "&"
    _hash = sp.bytes("0x23")  # "#"
    _space = sp.bytes("0x20")  # " "
    _s_eq = sp.bytes("0x733D")  # "s="
    _i_eq = sp.bytes("0x693d")  # "i="
    _p_eq = sp.bytes("0x703D")  # "p="
    _v_eq = sp.bytes("0x763D")  # "v="
    _n_eq = sp.bytes("0x6E3D")  # "n="

    def build_artifact_uri(
        params: sp.record(
            artifact_cid=sp.bytes,
            seed_hex=sp.bytes,
            params=sp.bytes,
            iteration_number=sp.nat,
        ),
    ) -> sp.bytes:
        artifact_uri = (
            params.artifact_cid
            + _q
            + _s_eq
            + params.seed_hex
            + _and
            + _i_eq
            + bytes_utils.from_nat(params.iteration_number)
        )
        if params.params != sp.bytes("0x"):
            artifact_uri += _and + _p_eq + params.params
        return artifact_uri

    def build_thumbnail_uri(
        params: sp.record(
            token_id=sp.nat, version=sp.nat, network=sp.bytes, thumbnail_prefix=sp.bytes
        ),
    ) -> sp.bytes:
        # Format: https://media.{shadownet}.bootloader.art/generic-web/v1/thumbnail/{token_id}?v={version}&n={network})
        return (
            params.thumbnail_prefix
            + bytes_utils.from_nat(params.token_id)
            + _q
            + _v_eq
            + bytes_utils.from_nat(params.version)
            + _and
            + _n_eq
            + params.network
        )

    def build_name(params: sp.record(name=sp.bytes, iteration_number=sp.nat)):
        return (
            params.name + _space + _hash + bytes_utils.from_nat(params.iteration_number)
        )

    # Order of inheritance: [Admin], [<policy>], <base class>, [<other mixins>].
    class Bootloader(
        main.Admin,
        main.Nft,
        main.MintNft,
        main.BurnNft,
        main.OnchainviewBalanceOf,
    ):
        def __init__(self):
            main.OnchainviewBalanceOf.__init__(self)
            main.BurnNft.__init__(self)
            main.MintNft.__init__(self)
            main.Nft.__init__(self, sp.big_map({}), {}, [])
            main.Admin.__init__(self, NULL_ADDRESS)

            self.data.next_token_id = 0
            self.data.next_generator_id = 0
            self.data.treasury = NULL_ADDRESS
            self.data.token_extra = sp.cast(
                sp.big_map({}),
                sp.big_map[
                    sp.nat,
                    sp.record(
                        generator_id=sp.nat,
                        generator_version=sp.nat,
                        offchain_metadata_updated=sp.bool,
                        params=sp.bytes,
                        raw_seed=sp.option[sp.bytes],
                        iteration_number=sp.nat,
                    ),
                ],
            )
            self.data.platform_fee_bps = sp.nat(1500)
            self.data.network = sp.bytes("0x73")  # "s" for shadownet, "m" for mainnet
            self.data.thumbnail_prefix = sp.bytes(
                "0x68747470733a2f2f6d656469612e736861646f776e65742e626f6f746c6f616465722e6172742f67656e657269632d7765622f76312f7468756d626e61696c2f"
            )  # "https://media.shadownet.bootloader.art/generic-web/v1/thumbnail/" <- drop shadownet for mainnet
            self.data.rng_contracts = sp.cast(
                sp.big_map({}), sp.big_map[sp.address, sp.unit]
            )
            self.data.moderators = sp.cast(
                sp.big_map({}), sp.big_map[sp.address, sp.unit]
            )
            self.data.generator_mints = sp.cast(
                sp.big_map({}), sp.big_map[sp.pair[sp.nat, sp.address], sp.nat]
            )
            self.data.generators = sp.cast(
                sp.big_map({}),
                sp.big_map[
                    sp.nat,
                    sp.record(
                        author=sp.address,
                        name=sp.bytes,
                        created=sp.timestamp,
                        last_update=sp.timestamp,
                        artifact_cid=sp.bytes,
                        metadata_cid=sp.bytes,
                        n_tokens=sp.nat,
                        version=sp.nat,
                        flag=sp.nat,
                        rng_contract=sp.address,
                        reserved_editions=sp.nat,
                        allow_bl_metadata_update=sp.bool,
                        sale=sp.option[
                            sp.record(
                                paused=sp.bool,
                                start_time=sp.option[sp.timestamp],
                                price=sp.mutez,
                                editions=sp.nat,
                                max_per_wallet=sp.option[sp.nat],
                            )
                        ],
                    ),
                ],
            )

        @sp.entrypoint
        def add_moderator(self, address: sp.address):
            assert sp.sender == self.data.administrator, "ONLY_ADMIN"
            self.data.moderators[address] = ()

        @sp.entrypoint
        def remove_moderator(self, address: sp.address):
            assert sp.sender == self.data.administrator, "ONLY_ADMIN"
            del self.data.moderators[address]

        @sp.entrypoint
        def set_network(self, network: sp.bytes):
            assert sp.sender == self.data.administrator, "ONLY_ADMIN"
            assert len(network) == 1, "NETWORK_MUST_BE_1_BYTE"
            self.data.network = network

        @sp.entrypoint
        def create_generator(
            self,
            name: sp.bytes,
            artifact_cid: sp.bytes,
            metadata_cid: sp.bytes,
            rng_contract: sp.address,
            reserved_editions: sp.nat,
            allow_bl_metadata_update: sp.bool,
        ):
            assert rng_contract in self.data.rng_contracts, "INVALID_RNG_CONTRACT"
            self.data.generators[self.data.next_generator_id] = sp.record(
                author=sp.sender,
                name=name,
                created=sp.now,
                last_update=sp.now,
                artifact_cid=artifact_cid,
                metadata_cid=metadata_cid,
                n_tokens=0,
                version=1,
                flag=0,
                reserved_editions=reserved_editions,
                rng_contract=rng_contract,
                allow_bl_metadata_update=allow_bl_metadata_update,
                sale=None,
            )

            self.data.next_generator_id += 1

        @sp.entrypoint
        def update_generator(
            self,
            generator_id: sp.nat,
            name: sp.bytes,
            artifact_cid: sp.bytes,
            rng_contract: sp.address,
            reserved_editions: sp.nat,
            allow_bl_metadata_update: sp.bool,
            metadata_cid: sp.bytes,
        ):
            generator = self.data.generators.get(
                generator_id, error="GENERATOR_NOT_FOUND"
            )
            assert sp.sender == generator.author, "ONLY_AUTHOR"
            assert rng_contract in self.data.rng_contracts, "INVALID_RNG_CONTRACT"

            # if generator has sale configured. Ensure reserved_editions are not more than remaining capacity
            match generator.sale:
                case Some(sale):
                    assert generator.n_tokens + reserved_editions <= sale.editions, (
                        "RESERVE_EXCEEDS_CAPACITY"
                    )

            new_version = generator.version
            if artifact_cid != generator.artifact_cid:
                new_version += 1

            self.data.generators[generator_id] = sp.record(
                name=name,
                created=generator.created,
                last_update=sp.now,
                author=sp.sender,
                artifact_cid=artifact_cid,
                n_tokens=generator.n_tokens,
                version=new_version,
                flag=generator.flag,
                reserved_editions=reserved_editions,
                metadata_cid=metadata_cid,
                rng_contract=rng_contract,
                allow_bl_metadata_update=allow_bl_metadata_update,
                sale=generator.sale,
            )

        @sp.entrypoint
        def delete_generator(self, generator_id: sp.nat):
            generator = self.data.generators[generator_id]
            assert sp.sender == generator.author, "ONLY_AUTHOR"
            assert generator.n_tokens == 0, "TOKENS_MINTED"
            del self.data.generators[generator_id]

        @sp.entrypoint
        def set_sale(
            self,
            generator_id: sp.nat,
            start_time: sp.option[sp.timestamp],
            price: sp.mutez,
            paused: sp.bool,
            editions: sp.nat,
            max_per_wallet: sp.option[sp.nat],
        ):
            generator = self.data.generators[generator_id]
            assert sp.sender == generator.author, "ONLY_AUTHOR"
            # only allow reducing edition size
            match generator.sale:
                case Some(sale):
                    # but only if no tokens were minted yet
                    if generator.n_tokens > 0:
                        assert editions <= sale.editions, "NO_ED_INCREMENT"
            assert editions >= generator.n_tokens + generator.reserved_editions, (
                "ED_LT_MINTED"
            )
            self.data.generators[generator_id].sale = sp.Some(
                sp.record(
                    start_time=start_time,
                    price=price,
                    paused=paused,
                    editions=editions,
                    max_per_wallet=max_per_wallet,
                )
            )

        @sp.entrypoint
        def add_rng_contract(self, rng_contract: sp.address):
            assert (sp.sender in self.data.moderators) or (
                sp.sender == self.data.administrator
            ), "ONLY_MODS"
            self.data.rng_contracts[rng_contract] = ()

        @sp.entrypoint
        def remove_rng_contract(self, rng: sp.address):
            assert (sp.sender in self.data.moderators) or (
                sp.sender == self.data.administrator
            ), "ONLY_MODS"
            del self.data.rng_contracts[rng]

        @sp.entrypoint
        def update_rng_contract(
            self, generator_id: sp.nat, new_rng_contract: sp.address
        ):
            generator = self.data.generators[generator_id]
            assert (sp.sender in self.data.moderators) or (
                sp.sender == self.data.administrator
            ), "ONLY_MODS"
            assert new_rng_contract in self.data.rng_contracts, "INVALID_RNG_CONTRACT"
            self.data.generators[generator_id].rng_contract = new_rng_contract

        @sp.entrypoint
        def regenerate_token(self, token_id: sp.nat):
            assert self.data.ledger[token_id] == sp.sender, "ONLY_OWNER"
            token_extra = self.data.token_extra[token_id]
            generator = self.data.generators[token_extra.generator_id]
            assert generator.version > token_extra.generator_version, (
                "NO_UPDATE_POSSIBLE"
            )
            assert token_extra.raw_seed.is_some(), "SEED_NOT_SET"
            self.data.token_metadata[token_id] = sp.record(
                token_id=token_id,
                token_info={
                    "name": build_name(
                        sp.record(
                            name=generator.name,
                            iteration_number=token_extra.iteration_number,
                        )
                    ),
                    "artifact_uri": build_artifact_uri(
                        sp.record(
                            artifact_cid=generator.artifact_cid,
                            seed_hex=bytes_utils.to_hex_ascii(
                                token_extra.raw_seed.unwrap_some()
                            ),
                            params=token_extra.params,
                            iteration_number=token_extra.iteration_number,
                        )
                    ),
                    "thumbnail_uri": build_thumbnail_uri(
                        sp.record(
                            token_id=token_id,
                            version=generator.version,
                            network=self.data.network,
                            thumbnail_prefix=self.data.thumbnail_prefix,
                        )
                    ),
                },
            )

            self.data.token_extra[token_id].generator_version = generator.version
            self.data.token_extra[token_id].offchain_metadata_updated = False

        @sp.entrypoint
        def airdrop(
            self,
            generator_id: sp.nat,
            recipient: sp.address,
            entropy: sp.bytes,
            params: sp.bytes,
        ):
            generator = self.data.generators[generator_id]
            assert sp.sender == generator.author, "ONLY_AUTHOR"
            assert generator.reserved_editions > 0, "NO_RESERVED_LEFT"
            match generator.sale:
                case Some(sale):
                    assert generator.n_tokens < sale.editions, "NO_RESERVED_LEFT"

            self.data.generators[generator_id].reserved_editions = sp.as_nat(
                generator.reserved_editions - 1
            )

            token_id = self.data.next_token_id

            self.data.token_metadata[token_id] = sp.record(
                token_id=token_id,
                token_info={
                    "name": build_name(
                        sp.record(
                            name=generator.name, iteration_number=generator.n_tokens + 1
                        )
                    ),
                    "_artifact_uri": build_artifact_uri(
                        sp.record(
                            artifact_cid=generator.artifact_cid,
                            seed_hex=bytes_utils.to_hex_ascii(EMPTY_SEED),
                            params=params,
                            iteration_number=generator.n_tokens + 1,
                        )
                    ),
                },
            )

            self.data.ledger[token_id] = recipient
            self.data.token_extra[token_id] = sp.record(
                generator_id=generator_id,
                raw_seed=None,
                params=params,
                generator_version=generator.version,
                iteration_number=generator.n_tokens + 1,
                offchain_metadata_updated=False,
            )
            self.data.generators[generator_id].n_tokens += 1
            self.data.next_token_id += 1
            self._request_entropy(
                sp.record(
                    token_id=token_id,
                    entropy=entropy,
                    rng_contract=generator.rng_contract,
                )
            )

        @sp.entrypoint
        def mint(self, generator_id: sp.nat, entropy: sp.bytes, params: sp.bytes):
            generator = self.data.generators[generator_id]
            assert generator.sale.is_some(), "NO_SALE_CONFIG"
            match generator.sale:
                case Some(sale):
                    assert not sale.paused, "SALE_PAUSED"
                    assert sp.amount == sale.price, "PRICE_MISMATCH"

                    match sale.start_time:
                        case Some(start_time):
                            assert sp.now >= start_time, "SALE_NOT_STARTED"

                    assert (
                        generator.n_tokens + generator.reserved_editions < sale.editions
                    ), "PUBLIC_SOLD_OUT"

                    # enforce (optional) max per wallet
                    minted_key = (generator_id, sp.sender)
                    n_minted = self.data.generator_mints.get(minted_key, default=0)
                    match sale.max_per_wallet:
                        case Some(max_per_wallet):
                            assert max_per_wallet > n_minted, "EXCEEDS_MAX_PER_WALLET"
                    self.data.generator_mints[minted_key] = n_minted + 1

                    if sp.amount > sp.mutez(0):
                        platform_fee = sp.split_tokens(
                            sp.amount, self.data.platform_fee_bps, 10_000
                        )
                        rest = sp.amount - platform_fee
                        if platform_fee > sp.mutez(0):
                            sp.send(self.data.treasury, platform_fee)
                        if rest > sp.mutez(0):
                            sp.send(generator.author, rest)

                    token_id = self.data.next_token_id
                    self.data.token_metadata[token_id] = sp.record(
                        token_id=token_id,
                        token_info={
                            "name": build_name(
                                sp.record(
                                    name=generator.name,
                                    iteration_number=generator.n_tokens + 1,
                                )
                            ),
                            "_artifact_uri": build_artifact_uri(
                                sp.record(
                                    artifact_cid=generator.artifact_cid,
                                    seed_hex=bytes_utils.to_hex_ascii(EMPTY_SEED),
                                    params=params,
                                    iteration_number=generator.n_tokens + 1,
                                )
                            ),
                        },
                    )

                    self.data.ledger[token_id] = sp.sender
                    self.data.token_extra[token_id] = sp.record(
                        generator_id=generator_id,
                        raw_seed=None,
                        params=params,
                        generator_version=generator.version,
                        iteration_number=generator.n_tokens + 1,
                        offchain_metadata_updated=False,
                    )
                    self.data.generators[generator_id].n_tokens += 1
                    self.data.next_token_id += 1
                    self._request_entropy(
                        sp.record(
                            token_id=token_id,
                            entropy=entropy,
                            rng_contract=generator.rng_contract,
                        )
                    )
                case None:
                    raise "NO_SALE_CONFIGURED"

        @sp.entrypoint
        def set_offchain_metadata(
            self, params: sp.record(token_id=sp.nat, metadata_cid=sp.bytes)
        ):
            # used to set offchain metadata (description, attributes, tags etc.).
            token_extra = self.data.token_extra[params.token_id]
            generator = self.data.generators[token_extra.generator_id]
            assert (
                not self.data.token_extra[params.token_id].offchain_metadata_updated
                or generator.allow_bl_metadata_update
            ), "METADATA_ALREADY_UPDATED"
            assert (
                sp.sender == generator.author or sp.sender == self.data.administrator
            ), "ONLY_AUTHOR_OR_MODS"
            token_info = self.data.token_metadata[params.token_id].token_info
            token_info[""] = params.metadata_cid
            self.data.token_metadata[params.token_id] = sp.record(
                token_id=params.token_id, token_info=token_info
            )
            self.data.token_extra[params.token_id].offchain_metadata_updated = True

        @sp.entrypoint
        def set_entropy(self, params: sp.record(token_id=sp.nat, entropy=sp.bytes)):
            assert len(params.entropy) == 32, "INVALID_SEED_LENGTH"
            token_extra = self.data.token_extra[params.token_id]
            assert token_extra.raw_seed.is_none(), "SEED_SET"
            generator = self.data.generators[token_extra.generator_id]
            assert sp.sender == generator.rng_contract, "INVALID_RNG_CONTRACT"

            self.data.token_metadata[params.token_id] = sp.record(
                token_id=params.token_id,
                token_info={
                    "name": build_name(
                        sp.record(
                            name=generator.name,
                            iteration_number=token_extra.iteration_number,
                        )
                    ),
                    "artifact_uri": build_artifact_uri(
                        sp.record(
                            artifact_cid=generator.artifact_cid,
                            seed_hex=bytes_utils.to_hex_ascii(params.entropy),
                            params=token_extra.params,
                            iteration_number=token_extra.iteration_number,
                        )
                    ),
                    "thumbnail_uri": build_thumbnail_uri(
                        sp.record(
                            token_id=params.token_id,
                            version=1,
                            network=self.data.network,
                            thumbnail_prefix=self.data.thumbnail_prefix,
                        )
                    ),
                },
            )
            self.data.token_extra[params.token_id].raw_seed = sp.Some(params.entropy)

        @sp.entrypoint
        def update_token_thumbnail(
            self, params: sp.record(token_id=sp.nat, thumbnail_cid=sp.bytes)
        ):
            token_extra = self.data.token_extra[params.token_id]
            generator = self.data.generators[token_extra.generator_id]
            assert (
                sp.sender == generator.author or sp.sender == self.data.administrator
            ), "ONLY_AUTHOR_OR_MODS"
            token_metadata = self.data.token_metadata[params.token_id]
            token_metadata.token_info["thumbnail_uri"] = params.thumbnail_cid
            self.data.token_metadata[params.token_id] = token_metadata

        @sp.private(with_storage="read-only", with_operations=True)
        def _request_entropy(self, params):
            contract = sp.contract(
                sp.record(token_id=sp.nat, entropy=sp.bytes),
                params.rng_contract,
                entrypoint="request_entropy",
            ).unwrap_some()
            sp.transfer(
                sp.record(token_id=params.token_id, entropy=params.entropy),
                sp.mutez(0),
                contract,
            )

        @sp.onchain_view()
        def get_generator_id(self, token_id: sp.nat) -> sp.nat:
            token_extra = self.data.token_extra[token_id]
            return token_extra.generator_id
