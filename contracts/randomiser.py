import smartpy as sp

@sp.module
def randomiser():
    # Type definitions using new syntax
    t_storage: type = sp.record(
        metadata=sp.big_map[sp.string, sp.bytes],
        b=sp.bytes
    )

    class Randomiser(sp.Contract):
        def __init__(self, ):
            # Initialize contract data directly on self.data
            self.data.metadata = sp.cast(sp.big_map({}), sp.big_map[sp.string, sp.bytes])
            self.data.b = sp.bytes("0x")
            
            # Cast the entire storage to the defined type
            sp.cast(self.data, t_storage)

        @sp.private(with_storage="read-only", with_operations=False)
        def get_next_value(self, bytes_in):
            """Get next random value using multiple entropy sources"""
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



# Test scenarios
if "main" in __name__:
    @sp.add_test()
    def test_randomiser():
        # Test scenario
        scenario = sp.test_scenario("randomiser", randomiser)
        
        # Create contract instances
        contract = randomiser.Randomiser()
        scenario += contract