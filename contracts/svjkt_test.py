from svjkt import svjkt
from randomiser import randomiser

import smartpy as sp

@sp.add_test()
def test():
    # Create and configure the test scenario
    # Import the types from the FA2 library, the library itself, and the contract module, in that order.
    scenario = sp.test_scenario("svjkt_test")


    # Define test accounts
    admin = sp.test_account("Admin")
    alice = sp.test_account("Alice")
    bob = sp.test_account("Bob")
    r = randomiser.Randomiser()
    scenario += r
    # Instantiate the FA2 NFT contract
    contract = svjkt.SVJKT(
        admin.address, r.address, sp.big_map({}), {}, []
    )
    scenario += contract
    for i in range(4):
        contract.add_fragment(sp.record(frag_id=i, frag=sp.bytes("0x00")), _sender=admin.address)
    contract.create_generator(name=sp.bytes("0x"), description=sp.bytes("0x"), code=sp.bytes("0x00"), royalty_address=sp.bytes("0x00"), _sender=alice.address)
    import os
    contract.mint(generator_id=0, entropy=sp.bytes("0x" + os.urandom(16).hex()), _sender=alice.address, _valid=False)
    contract.set_sale(generator_id=0, start_time=sp.some(sp.timestamp(100)), _sender=alice.address, price=sp.mutez(100), paused=True, editions=500)
    contract.mint(generator_id=0, entropy=sp.bytes("0x" + os.urandom(16).hex()), _sender=alice.address, _valid=False)
    contract.mint(generator_id=0, entropy=sp.bytes("0x" + os.urandom(16).hex()), _sender=alice.address, _valid=False, _amount=sp.mutez(100))
    contract.set_sale(generator_id=0, start_time=sp.some(sp.timestamp(100)), _sender=alice.address, price=sp.mutez(100), paused=False, editions=500)
    contract.mint(generator_id=0, entropy=sp.bytes("0x" + os.urandom(16).hex()), _sender=alice.address, _amount=sp.mutez(100), _now=sp.timestamp(100))


    # for i in range(10):
        # contract.mint(generator_id=0, entropy=sp.bytes("0x" + os.urandom(16).hex()), _sender=alice.address)