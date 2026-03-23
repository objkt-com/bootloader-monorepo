import smartpy as sp


@sp.module
def fixed_price_sale():
    t_sale_update_request: type = sp.record(
        content_changed=sp.bool,
        new_total_editions=sp.nat,
        new_reserved_remaining=sp.nat,
    )

    t_sale_set_remaining_params: type = sp.record(
        generator_id=sp.nat,
        sale_remaining=sp.nat,
    )

    t_sale_mint_params: type = sp.record(
        generator_id=sp.nat,
        recipient=sp.address,
        entropy=sp.bytes,
        params=sp.bytes,
    )

    class FixedPriceSale(sp.Contract):
        def __init__(
            self,
            bootloader: sp.address,
            generator_id: sp.nat,
            author: sp.address,
            treasury: sp.address,
            platform_fee_bps: sp.nat,
            price: sp.mutez,
            paused: sp.bool,
            start_time: sp.option[sp.timestamp],
            max_per_wallet: sp.option[sp.nat],
        ):
            self.data.bootloader = bootloader
            self.data.generator_id = generator_id
            self.data.author = author
            self.data.treasury = treasury
            self.data.platform_fee_bps = platform_fee_bps
            self.data.price = price
            self.data.paused = paused
            self.data.start_time = start_time
            self.data.max_per_wallet = max_per_wallet
            self.data.mints = sp.cast(sp.big_map({}), sp.big_map[sp.address, sp.nat])

        @sp.entrypoint
        def buy(self, entropy: sp.bytes, params: sp.bytes):
            assert not self.data.paused, "SALE_PAUSED"
            assert sp.amount == self.data.price, "PRICE_MISMATCH"

            match self.data.start_time:
                case Some(start_time):
                    assert sp.now >= start_time, "SALE_NOT_STARTED"
                case None:
                    pass

            minted = self.data.mints.get(sp.sender, default=0)
            match self.data.max_per_wallet:
                case Some(max_per_wallet):
                    assert minted < max_per_wallet, "EXCEEDS_MAX_PER_WALLET"
                case None:
                    pass
            self.data.mints[sp.sender] = minted + 1

            if sp.amount > sp.mutez(0):
                platform_fee = sp.split_tokens(
                    sp.amount, self.data.platform_fee_bps, 10_000
                )
                rest = sp.amount - platform_fee
                if platform_fee > sp.mutez(0):
                    sp.send(self.data.treasury, platform_fee)
                if rest > sp.mutez(0):
                    sp.send(self.data.author, rest)

            contract = sp.contract(
                t_sale_mint_params,
                self.data.bootloader,
                entrypoint="sale_mint",
            ).unwrap_some()
            sp.transfer(
                sp.record(
                    generator_id=self.data.generator_id,
                    recipient=sp.sender,
                    entropy=entropy,
                    params=params,
                ),
                sp.mutez(0),
                contract,
            )

        @sp.entrypoint
        def update_config(
            self,
            start_time: sp.option[sp.timestamp],
            price: sp.mutez,
            paused: sp.bool,
            max_per_wallet: sp.option[sp.nat],
            sale_remaining: sp.nat,
        ):
            assert sp.sender == self.data.author, "ONLY_AUTHOR"
            self.data.start_time = start_time
            self.data.price = price
            self.data.paused = paused
            self.data.max_per_wallet = max_per_wallet

            contract = sp.contract(
                t_sale_set_remaining_params,
                self.data.bootloader,
                entrypoint="sale_set_remaining",
            ).unwrap_some()
            sp.transfer(
                sp.record(
                    generator_id=self.data.generator_id,
                    sale_remaining=sale_remaining,
                ),
                sp.mutez(0),
                contract,
            )

        @sp.entrypoint
        def set_payouts(
            self,
            author: sp.address,
            treasury: sp.address,
            platform_fee_bps: sp.nat,
        ):
            assert sp.sender == self.data.author, "ONLY_AUTHOR"
            self.data.author = author
            self.data.treasury = treasury
            self.data.platform_fee_bps = platform_fee_bps

        @sp.onchain_view()
        def can_update(self, params: t_sale_update_request) -> sp.bool:
            return True
