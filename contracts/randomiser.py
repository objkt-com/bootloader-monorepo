import smartpy as sp

@sp.module
def randomiser():
    class RandomiserMock(sp.Contract):
        def __init__(self, ):
            self.data.metadata = sp.cast(sp.big_map({}), sp.big_map[sp.string, sp.bytes])
            self.data.b = sp.bytes("0x")

        @sp.private(with_storage="read-only", with_operations=False)
        def get_next_value(self, bytes_in):
            """The Randomiser on mainnet uses more on-chain sources"""
            return sp.sha256(bytes_in + sp.pack(sp.now) + sp.pack(sp.source))

        @sp.entrypoint
        def default(self):
            """Default entrypoint that updates randomness"""
            # Check no incoming transfer
            assert sp.amount == sp.mutez(0), "NO_MUTEZ"
            
            # Update randomness
            self.data.b = self.get_next_value(self.data.b)

        @sp.entrypoint
        def supply_entropy(self, params):
            """Supply additional entropy to the randomizer"""
            sp.cast(params, sp.bytes)
            self.data.b = self.get_next_value(self.data.b + params)

        @sp.onchain_view()
        def rb(self, params):
            """Get random bytes with additional entropy"""
            sp.cast(params, sp.bytes)
            return self.get_next_value(self.data.b + params)

        @sp.onchain_view()
        def r(self):
            """Get current random value"""
            return self.get_next_value(self.data.b)

        @sp.onchain_view()
        def b(self):
            """Get current entropy bytes"""
            return self.data.b
