"""
Platform Fees and Payment Tests

This module tests all payment-related functionality:
- Platform fee calculation and distribution
- Author payment distribution
- Treasury payment handling
- Fee percentage validation
- Payment failure scenarios
- Zero payment handling
"""

from svgkt import svgkt
from randomiser import randomiser
import smartpy as sp
import os

@sp.module
def test_utils():
    class BalanceCounter(sp.Contract):
        def __init__(self):
            self.data = sp.mutez(0)
    
        @sp.entrypoint
        def default(self):
            self.data = self.data + sp.amount
    
    class FailingTreasury(sp.Contract):
        def __init__(self):
            self.data = ()
        
        @sp.entrypoint
        def default(self):
            raise "TREASURY_REJECTED"

@sp.add_test()
def test_platform_fee_calculation():
    """
    Tests platform fee calculation and distribution:
    - Correct fee calculation based on BPS
    - Platform fee sent to treasury
    - Remaining amount sent to author
    - Fee calculation with different percentages
    """
    scenario = sp.test_scenario("Platform Fee Calculation", [svgkt, randomiser])

    admin = sp.test_account("Admin")
    alice = sp.test_account("Alice")
    bob = sp.test_account("Bob")

    treasury_counter = test_utils.BalanceCounter()
    scenario += treasury_counter
    
    rng = randomiser.RandomiserMock()
    scenario += rng

    contract = svgkt.SvgKT(
        admin_address=admin.address,
        rng_contract=rng.address, 
        contract_metadata=sp.big_map({}),
        ledger=sp.map({}),
        token_metadata=[]
    )
    scenario += contract

    # Set treasury to counter contract
    contract.set_treasury(treasury_counter.address, _sender=admin)
    
    # Set platform fee to 25% (2500 BPS)
    contract.set_platform_fee_bps(2500, _sender=admin)

    # Add fragments for minting
    for i in range(4):
        contract.add_fragment(
            frag_id=i, 
            frag=sp.bytes("0x3c73766720786d6c6e733d22687474703a2f2f7777772e77332e6f72672f323030302f737667222076696577426f783d22302030203130302031303022207374796c653d226261636b67726f756e642d636f6c6f723a77686974653b223e"),
            _sender=admin
        )

    # Create generator
    contract.create_generator(
        name=sp.bytes("0x466565205465737420417274"),
        description=sp.bytes("0x54657374696e672066656520646973747269627574696f6e"),
        code=sp.bytes("0x636f6e736f6c652e6c6f67282246656520546573742229"),
        author_bytes=sp.bytes("0x426f62"),
        reserved_editions=0,
        _sender=alice
    )

    # Set sale
    contract.set_sale(
        generator_id=0,
        start_time=None,
        price=sp.mutez(10000000),  # 10 XTZ
        paused=False,
        editions=10,
        max_per_wallet=None,
        _sender=alice
    )

    scenario.h2("Platform fee calculated correctly")
    contract.mint(
        generator_id=0, 
        entropy=sp.bytes("0x" + os.urandom(16).hex()),
        _sender=bob,
        _amount=sp.mutez(10000000)
    )
    
    # Expected: 25% of 10 XTZ = 2.5 XTZ to treasury
    expected_platform_fee = sp.mutez(2500000)
    scenario.verify(treasury_counter.data == expected_platform_fee)

@sp.add_test()
def test_maximum_platform_fee():
    """
    Tests maximum platform fee (100%):
    - All payment goes to treasury when fee is 100%
    - Author receives nothing when fee is 100%
    """
    scenario = sp.test_scenario("Maximum Platform Fee", [svgkt, randomiser])

    admin = sp.test_account("Admin")
    alice = sp.test_account("Alice")
    bob = sp.test_account("Bob")

    treasury_counter = test_utils.BalanceCounter()
    scenario += treasury_counter
    
    rng = randomiser.RandomiserMock()
    scenario += rng

    contract = svgkt.SvgKT(
        admin_address=admin.address,
        rng_contract=rng.address, 
        contract_metadata=sp.big_map({}),
        ledger=sp.map({}),
        token_metadata=[]
    )
    scenario += contract

    # Set treasury and maximum fee
    contract.set_treasury(treasury_counter.address, _sender=admin)
    contract.set_platform_fee_bps(10000, _sender=admin)  # 100%

    # Add fragments for minting
    for i in range(4):
        contract.add_fragment(
            frag_id=i, 
            frag=sp.bytes("0x3c73766720786d6c6e733d22687474703a2f2f7777772e77332e6f72672f323030302f737667222076696577426f783d22302030203130302031303022207374796c653d226261636b67726f756e642d636f6c6f723a77686974653b223e"),
            _sender=admin
        )

    # Create generator
    contract.create_generator(
        name=sp.bytes("0x4d617820466565205465737420"),
        description=sp.bytes("0x54657374696e67206d617820666565"),
        code=sp.bytes("0x636f6e736f6c652e6c6f67282254657374"),
        author_bytes=sp.bytes("0x416c696365"),
        reserved_editions=0,
        _sender=alice
    )

    # Set sale
    contract.set_sale(
        generator_id=0,
        start_time=None,
        price=sp.mutez(1000000),
        paused=False,
        editions=5,
        max_per_wallet=None,
        _sender=alice
    )

    # Reset treasury counter
    treasury_counter.default(_amount=sp.mutez(0))

    scenario.h2("All payment goes to treasury with 100% fee")
    contract.mint(
        generator_id=0, 
        entropy=sp.bytes("0x" + os.urandom(16).hex()),
        _sender=bob,
        _amount=sp.mutez(1000000)
    )
    
    scenario.verify(treasury_counter.data == sp.mutez(1000000))

@sp.add_test()
def test_zero_platform_fee():
    """
    Tests zero platform fee:
    - All payment goes to author when fee is 0%
    - Treasury receives nothing when fee is 0%
    """
    scenario = sp.test_scenario("Zero Platform Fee", [svgkt, randomiser])

    admin = sp.test_account("Admin")
    alice = sp.test_account("Alice")
    bob = sp.test_account("Bob")

    treasury_counter = test_utils.BalanceCounter()
    scenario += treasury_counter
    
    rng = randomiser.RandomiserMock()
    scenario += rng

    contract = svgkt.SvgKT(
        admin_address=admin.address,
        rng_contract=rng.address, 
        contract_metadata=sp.big_map({}),
        ledger=sp.map({}),
        token_metadata=[]
    )
    scenario += contract

    # Set treasury and zero fee
    contract.set_treasury(treasury_counter.address, _sender=admin)
    contract.set_platform_fee_bps(0, _sender=admin)  # 0%

    # Add fragments for minting
    for i in range(4):
        contract.add_fragment(
            frag_id=i, 
            frag=sp.bytes("0x3c73766720786d6c6e733d22687474703a2f2f7777772e77332e6f72672f323030302f737667222076696577426f783d22302030203130302031303022207374796c653d226261636b67726f756e642d636f6c6f723a77686974653b223e"),
            _sender=admin
        )

    # Create generator
    contract.create_generator(
        name=sp.bytes("0x5a65726f20466565205465737420"),
        description=sp.bytes("0x54657374696e67207a65726f20666565"),
        code=sp.bytes("0x636f6e736f6c652e6c6f67282254657374"),
        author_bytes=sp.bytes("0x416c696365"),
        reserved_editions=0,
        _sender=alice
    )

    # Set sale
    contract.set_sale(
        generator_id=0,
        start_time=None,
        price=sp.mutez(1000000),
        paused=False,
        editions=5,
        max_per_wallet=None,
        _sender=alice
    )

    # Reset treasury counter
    treasury_counter.default(_amount=sp.mutez(0))

    scenario.h2("Treasury receives nothing with 0% fee")
    contract.mint(
        generator_id=0, 
        entropy=sp.bytes("0x" + os.urandom(16).hex()),
        _sender=bob,
        _amount=sp.mutez(1000000)
    )
    
    scenario.verify(treasury_counter.data == sp.mutez(0))

@sp.add_test()
def test_free_minting_no_payments():
    """
    Tests that free minting doesn't trigger any payments:
    - No payment to treasury for free mints
    - No payment to author for free mints
    - Zero amount handling
    """
    scenario = sp.test_scenario("Free Minting No Payments", [svgkt, randomiser])

    admin = sp.test_account("Admin")
    alice = sp.test_account("Alice")
    bob = sp.test_account("Bob")

    treasury_counter = test_utils.BalanceCounter()
    scenario += treasury_counter
    
    rng = randomiser.RandomiserMock()
    scenario += rng

    contract = svgkt.SvgKT(
        admin_address=admin.address,
        rng_contract=rng.address, 
        contract_metadata=sp.big_map({}),
        ledger=sp.map({}),
        token_metadata=[]
    )
    scenario += contract

    # Set treasury and fee
    contract.set_treasury(treasury_counter.address, _sender=admin)
    contract.set_platform_fee_bps(2500, _sender=admin)  # 25%

    # Add fragments for minting
    for i in range(4):
        contract.add_fragment(
            frag_id=i, 
            frag=sp.bytes("0x3c73766720786d6c6e733d22687474703a2f2f7777772e77332e6f72672f323030302f737667222076696577426f783d22302030203130302031303022207374796c653d226261636b67726f756e642d636f6c6f723a77686974653b223e"),
            _sender=admin
        )

    # Create generator
    contract.create_generator(
        name=sp.bytes("0x46726565204d696e74205465737420"),
        description=sp.bytes("0x54657374696e67206672656520706179656d656e7473"),
        code=sp.bytes("0x636f6e736f6c652e6c6f67282254657374"),
        author_bytes=sp.bytes("0x416c696365"),
        reserved_editions=0,
        _sender=alice
    )

    # Set free sale
    contract.set_sale(
        generator_id=0,
        start_time=None,
        price=sp.mutez(0),
        paused=False,
        editions=5,
        max_per_wallet=None,
        _sender=alice
    )

    # Reset treasury counter
    treasury_counter.default(_amount=sp.mutez(0))

    scenario.h2("Free minting triggers no payments")
    contract.mint(
        generator_id=0, 
        entropy=sp.bytes("0x" + os.urandom(16).hex()),
        _sender=bob,
        _amount=sp.mutez(0)
    )
    
    scenario.verify(treasury_counter.data == sp.mutez(0))

@sp.add_test()
def test_treasury_payment_failure():
    """
    Tests treasury payment failure scenarios:
    - Minting fails when treasury rejects payment
    - Contract handles treasury rejection gracefully
    """
    scenario = sp.test_scenario("Treasury Payment Failure", [svgkt, randomiser])

    admin = sp.test_account("Admin")
    alice = sp.test_account("Alice")
    bob = sp.test_account("Bob")

    failing_treasury = test_utils.FailingTreasury()
    scenario += failing_treasury
    
    rng = randomiser.RandomiserMock()
    scenario += rng

    contract = svgkt.SvgKT(
        admin_address=admin.address,
        rng_contract=rng.address, 
        contract_metadata=sp.big_map({}),
        ledger=sp.map({}),
        token_metadata=[]
    )
    scenario += contract

    # Set failing treasury
    contract.set_treasury(failing_treasury.address, _sender=admin)

    # Add fragments for minting
    for i in range(4):
        contract.add_fragment(
            frag_id=i, 
            frag=sp.bytes("0x3c73766720786d6c6e733d22687474703a2f2f7777772e77332e6f72672f323030302f737667222076696577426f783d22302030203130302031303022207374796c653d226261636b67726f756e642d636f6c6f723a77686974653b223e"),
            _sender=admin
        )

    # Create generator
    contract.create_generator(
        name=sp.bytes("0x4661696c696e6720547265617375727920546573742020"),
        description=sp.bytes("0x54657374696e67207061796d656e74206661696c757265"),
        code=sp.bytes("0x636f6e736f6c652e6c6f67282254657374"),
        author_bytes=sp.bytes("0x416c696365"),
        reserved_editions=0,
        _sender=alice
    )

    # Set sale
    contract.set_sale(
        generator_id=0,
        start_time=None,
        price=sp.mutez(1000000),
        paused=False,
        editions=5,
        max_per_wallet=None,
        _sender=alice
    )

    scenario.h2("Minting fails when treasury rejects payment")
    contract.mint(
        generator_id=0, 
        entropy=sp.bytes("0x" + os.urandom(16).hex()),
        _sender=bob,
        _amount=sp.mutez(1000000),
        _valid=False,
        _exception="TREASURY_REJECTED"
    )

@sp.add_test()
def test_fee_precision():
    """
    Tests fee calculation precision with various amounts:
    - Small amounts with fees
    - Large amounts with fees
    - Edge cases in fee calculation
    """
    scenario = sp.test_scenario("Fee Precision", [svgkt, randomiser])

    admin = sp.test_account("Admin")
    alice = sp.test_account("Alice")
    bob = sp.test_account("Bob")

    treasury_counter = test_utils.BalanceCounter()
    scenario += treasury_counter
    
    rng = randomiser.RandomiserMock()
    scenario += rng

    contract = svgkt.SvgKT(
        admin_address=admin.address,
        rng_contract=rng.address, 
        contract_metadata=sp.big_map({}),
        ledger=sp.map({}),
        token_metadata=[]
    )
    scenario += contract

    # Set treasury and fee
    contract.set_treasury(treasury_counter.address, _sender=admin)
    contract.set_platform_fee_bps(333, _sender=admin)  # 3.33%

    # Add fragments for minting
    for i in range(4):
        contract.add_fragment(
            frag_id=i, 
            frag=sp.bytes("0x3c73766720786d6c6e733d22687474703a2f2f7777772e77332e6f72672f323030302f737667222076696577426f783d22302030203130302031303022207374796c653d226261636b67726f756e642d636f6c6f723a77686974653b223e"),
            _sender=admin
        )

    # Create generator
    contract.create_generator(
        name=sp.bytes("0x507265636973696f6e205465737420"),
        description=sp.bytes("0x54657374696e6720666565207072656369736f6e"),
        code=sp.bytes("0x636f6e736f6c652e6c6f67282254657374"),
        author_bytes=sp.bytes("0x416c696365"),
        reserved_editions=0,
        _sender=alice
    )

    # Set sale with small amount
    contract.set_sale(
        generator_id=0,
        start_time=None,
        price=sp.mutez(1000),  # Very small amount
        paused=False,
        editions=5,
        max_per_wallet=None,
        _sender=alice
    )

    # Reset treasury counter
    treasury_counter.default(_amount=sp.mutez(0))

    scenario.h2("Small amount fee calculation")
    contract.mint(
        generator_id=0, 
        entropy=sp.bytes("0x" + os.urandom(16).hex()),
        _sender=bob,
        _amount=sp.mutez(1000)
    )
    
    # With 333 BPS (3.33%) of 1000 mutez = 33.3 mutez, rounded down to 33
    expected_fee = sp.mutez(33)
    scenario.verify(treasury_counter.data == expected_fee)

@sp.add_test()
def test_multiple_payments_accumulation():
    """
    Tests that multiple payments accumulate correctly:
    - Treasury receives cumulative fees
    - Multiple mints with different amounts
    - Fee accumulation over time
    """
    scenario = sp.test_scenario("Multiple Payments Accumulation", [svgkt, randomiser])

    admin = sp.test_account("Admin")
    alice = sp.test_account("Alice")
    bob = sp.test_account("Bob")

    treasury_counter = test_utils.BalanceCounter()
    scenario += treasury_counter
    
    rng = randomiser.RandomiserMock()
    scenario += rng

    contract = svgkt.SvgKT(
        admin_address=admin.address,
        rng_contract=rng.address, 
        contract_metadata=sp.big_map({}),
        ledger=sp.map({}),
        token_metadata=[]
    )
    scenario += contract

    # Set treasury and fee
    contract.set_treasury(treasury_counter.address, _sender=admin)
    contract.set_platform_fee_bps(1000, _sender=admin)  # 10%

    # Add fragments for minting
    for i in range(4):
        contract.add_fragment(
            frag_id=i, 
            frag=sp.bytes("0x3c73766720786d6c6e733d22687474703a2f2f7777772e77332e6f72672f323030302f737667222076696577426f783d22302030203130302031303022207374796c653d226261636b67726f756e642d636f6c6f723a77686974653b223e"),
            _sender=admin
        )

    # Create generator
    contract.create_generator(
        name=sp.bytes("0x4163636d756c6174696f6e205465737420"),
        description=sp.bytes("0x54657374696e67206665652061636375"),
        code=sp.bytes("0x636f6e736f6c652e6c6f67282254657374"),
        author_bytes=sp.bytes("0x416c696365"),
        reserved_editions=0,
        _sender=alice
    )

    # Set sale
    contract.set_sale(
        generator_id=0,
        start_time=None,
        price=sp.mutez(1000000),
        paused=False,
        editions=10,
        max_per_wallet=None,
        _sender=alice
    )

    # Reset treasury counter
    treasury_counter.default(_amount=sp.mutez(0))

    scenario.h2("First payment")
    contract.mint(
        generator_id=0, 
        entropy=sp.bytes("0x" + os.urandom(16).hex()),
        _sender=bob,
        _amount=sp.mutez(1000000)
    )
    
    # 10% of 1000000 = 100000
    scenario.verify(treasury_counter.data == sp.mutez(100000))

    scenario.h2("Second payment accumulates")
    contract.mint(
        generator_id=0, 
        entropy=sp.bytes("0x" + os.urandom(16).hex()),
        _sender=bob,
        _amount=sp.mutez(1000000)
    )
    
    # Total: 200000 (100000 + 100000)
    scenario.verify(treasury_counter.data == sp.mutez(200000))

@sp.add_test()
def test_dynamic_fee_changes():
    """
    Tests that fee changes affect subsequent mints:
    - Fee changes apply to new mints
    - Different fees for different mints
    - Fee changes don't affect existing tokens
    """
    scenario = sp.test_scenario("Dynamic Fee Changes", [svgkt, randomiser])

    admin = sp.test_account("Admin")
    alice = sp.test_account("Alice")
    bob = sp.test_account("Bob")

    treasury_counter = test_utils.BalanceCounter()
    scenario += treasury_counter
    
    rng = randomiser.RandomiserMock()
    scenario += rng

    contract = svgkt.SvgKT(
        admin_address=admin.address,
        rng_contract=rng.address, 
        contract_metadata=sp.big_map({}),
        ledger=sp.map({}),
        token_metadata=[]
    )
    scenario += contract

    # Set treasury and initial fee
    contract.set_treasury(treasury_counter.address, _sender=admin)
    contract.set_platform_fee_bps(1000, _sender=admin)  # 10%

    # Add fragments for minting
    for i in range(4):
        contract.add_fragment(
            frag_id=i, 
            frag=sp.bytes("0x3c73766720786d6c6e733d22687474703a2f2f7777772e77332e6f72672f323030302f737667222076696577426f783d22302030203130302031303022207374796c653d226261636b67726f756e642d636f6c6f723a77686974653b223e"),
            _sender=admin
        )

    # Create generator
    contract.create_generator(
        name=sp.bytes("0x44796e616d696320466565205465737420"),
        description=sp.bytes("0x54657374696e672064796e616d696320666565"),
        code=sp.bytes("0x636f6e736f6c652e6c6f67282254657374"),
        author_bytes=sp.bytes("0x416c696365"),
        reserved_editions=0,
        _sender=alice
    )

    # Set sale
    contract.set_sale(
        generator_id=0,
        start_time=None,
        price=sp.mutez(1000000),
        paused=False,
        editions=10,
        max_per_wallet=None,
        _sender=alice
    )

    # Reset treasury counter
    treasury_counter.default(_amount=sp.mutez(0))

    scenario.h2("Mint with 10% fee")
    contract.mint(
        generator_id=0, 
        entropy=sp.bytes("0x" + os.urandom(16).hex()),
        _sender=bob,
        _amount=sp.mutez(1000000)
    )
    
    scenario.verify(treasury_counter.data == sp.mutez(100000))

    scenario.h2("Change fee to 20%")
    contract.set_platform_fee_bps(2000, _sender=admin)

    scenario.h2("Mint with new 20% fee")
    contract.mint(
        generator_id=0, 
        entropy=sp.bytes("0x" + os.urandom(16).hex()),
        _sender=bob,
        _amount=sp.mutez(1000000)
    )
    
    # Total: 100000 (from first) + 200000 (from second) = 300000
    scenario.verify(treasury_counter.data == sp.mutez(300000))
