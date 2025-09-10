import smartpy as sp

@sp.module
def randomiser():
    class EmptyContract(sp.Contract):
        def __init__(self):
            self.data = ()

    class CentralisedRandomiser(sp.Contract):
        def __init__(self, ):
            self.data.metadata = sp.cast(sp.big_map({}), sp.big_map[sp.string, sp.bytes])
            self.data.requests = sp.cast(sp.big_map({}), sp.big_map[sp.nat, sp.record(
                user_entropy=sp.bytes
            )])
            self.data.b = sp.bytes("0x888888")
            self.data.testnet_mode = False

        @sp.private(with_storage="read-write", with_operations=False)
        def _testnet_obscurer(self, bytes_in):
            self.data.b = sp.sha256(bytes_in + sp.pack(sp.now) + sp.pack(sp.source))
            return self.data.b

        @sp.private(with_storage="read-write", with_operations=False)
        def _mainnet_obscurer(self, bytes_in):            
            next_ask_id = sp.view(
                "get_next_ask_id",
                sp.address("KT1SwbTqhSKF6Pdokiu1K4Fpi17ahPPzmt1X"),
                (),
                sp.nat
            ).unwrap_some()

            next_offer_id = sp.view(
                "get_next_offer_id",
                sp.address("KT1SwbTqhSKF6Pdokiu1K4Fpi17ahPPzmt1X"),
                (),
                sp.nat
            ).unwrap_some()

            exchange_rate = sp.view(
                "get_price_with_timestamp",
                sp.address("KT1ExbCyFbsvPQTUitHAK7HSfYkJgiCtBGpM"),
                "XTZUSDT",
                sp.record(price=sp.nat, timestmap=sp.timestamp)
            ).unwrap_some()

            next_auction_id = sp.view(
                "get_next_auction_id",
                sp.address("KT18iSHoRW1iogamADWwQSDoZa3QkN4izkqj"),
                (),
                sp.nat
            ).unwrap_some()

            get_swaps_counter = sp.view(
                "get_swaps_counter",
                sp.address("KT1PHubm9HtyQEJ4BBpMTVomq6mhbfNZ9z5w"),
                (),
                sp.nat
            ).unwrap_some()

            c = sp.create_contract_operation(EmptyContract, None, sp.mutez(0), ())

            a = bytes_in + \
                sp.pack(sp.now) + \
                sp.pack(sp.level) + \
                sp.pack(next_ask_id) + \
                sp.pack(next_offer_id) + \
                sp.pack(exchange_rate) + \
                sp.pack(next_auction_id) + \
                sp.pack(get_swaps_counter) + \
                sp.pack(sp.source) + \
                sp.pack(c.address)
            return sp.sha256(a)   

        @sp.entrypoint
        def default(self):
            """Default entrypoint that updates randomness"""
            # Check no incoming transfer
            assert sp.amount == sp.mutez(0), "NO_MUTEZ"
            # Update randomness
            if self.data.testnet_mode:
                self.data.b = self._testnet_obscurer(self.data.b)
            else:
                self.data.b = self._mainnet_obscurer(self.data.b)
        
        @sp.entrypoint
        def request_entropy(self, token_id, entropy):
            # in a future implementation this could be done with a commit-reveal 
            # scheme for now we are using this simple but gamable implementation
            # that allows for a instant reveal
            entropy_out = sp.bytes("0x")
            if self.data.testnet_mode:
                entropy_out = self._testnet_obscurer(entropy)
            else:
                entropy_out = self._mainnet_obscurer(entropy)
            
            self._set_entropy_callback(sp.record(address=sp.sender, token_id=token_id, entropy=entropy_out))

        @sp.private(with_storage="read-only", with_operations=True)
        def _set_entropy_callback(self, params):
            contract = sp.contract(sp.record(token_id=sp.nat, entropy=sp.bytes), params.address, entrypoint="set_entropy").unwrap_some()
            sp.transfer(sp.record(token_id=params.token_id, entropy=params.entropy), sp.mutez(0), contract)
