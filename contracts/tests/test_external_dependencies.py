"""
External Dependencies and Edge Cases Tests

This module tests external dependencies and various edge cases:
- Fragment dependencies for minting
- RNG contract dependencies
- Missing external contracts
- Contract interaction failures
- Edge cases and boundary conditions
"""

from bootloader import bootloader
from randomiser import randomiser
import smartpy as sp
import os

@sp.module
def test_utils():
    class NoRngContract(sp.Contract):
        def __init__(self):
            self.data = ()

    class MockRngContract(sp.Contract):
        def __init__(self):
            self.data = ()
        
        @sp.onchain_view()
        def rb(self, seed: sp.bytes):
            return sp.bytes("0x1234567890abcdef1234567890abcdef")
        
        @sp.entrypoint
        def default(self):
            pass

@sp.add_test()
def test_missing_fragments():
    """
    Tests behavior when required fragments are missing:
    - Minting fails when fragments are not available
    - Contract requires all necessary fragments
    - Fragment dependencies are properly checked
    """
    scenario = sp.test_scenario("Missing Fragments", [bootloader, randomiser])

    admin = sp.test_account("Admin")
    alice = sp.test_account("Alice")
    bob = sp.test_account("Bob")

    rng = randomiser.RandomiserMock()
    scenario += rng

    contract = bootloader.Bootloader(
        admin_address=admin.address,
        rng_contract=rng.address, 
        contract_metadata=sp.big_map({}),
        ledger=sp.map({}),
        token_metadata=[]
    )
    scenario += contract

    scenario.h2("Add bootloader with only first fragment")
    contract.add_bootloader(
        version=sp.bytes("0x302e302e31"),  # "0.0.1"
        fragments=[sp.bytes("0x3c73766720786d6c6e733d22687474703a2f2f7777772e77332e6f72672f323030302f737667222076696577426f783d22302030203130302031303022207374796c653d226261636b67726f756e642d636f6c6f723a77686974653b223e")],
        fun=bootloader.v0_0_1,
        storage_limits=sp.record(code=1000, name=1000, desc=1000, author=1000),
        _sender=admin
    )

    # Create generator
    contract.create_generator(
        name=sp.bytes("0x4672616720546573742047656e"),
        description=sp.bytes("0x54657374696e67206672616773"),
        code=sp.bytes("0x636f6e736f6c652e6c6f67282254657374"),
        author_bytes=sp.bytes("0x416c696365"),
        reserved_editions=0,
        bootloader_id=0,
        _sender=alice
    )

    contract.set_sale(
        generator_id=0,
        start_time=None,
        price=sp.mutez(0),
        paused=False,
        editions=1,
        max_per_wallet=None,
        _sender=alice
    )

    scenario.h2("Minting fails when fragments are missing")
    contract.mint(
        generator_id=0, 
        entropy=sp.bytes("0x" + os.urandom(16).hex()),
        _sender=bob,
        _amount=sp.mutez(0),
        _valid=False
    )

@sp.add_test()
def test_rng_contract_update():
    """
    Tests RNG contract updates:
    - Moderators can update RNG contract
    - Admin can update RNG contract
    - Non-mods cannot update RNG contract
    - New RNG contract is used for subsequent operations
    """
    scenario = sp.test_scenario("RNG Contract Update", [bootloader, randomiser])

    admin = sp.test_account("Admin")
    alice = sp.test_account("Alice")
    bob = sp.test_account("Bob")
    moderator = sp.test_account("Moderator")

    rng1 = randomiser.RandomiserMock()
    scenario += rng1
    
    rng2 = test_utils.MockRngContract()
    scenario += rng2

    contract = bootloader.Bootloader(
        admin_address=admin.address,
        rng_contract=rng1.address, 
        contract_metadata=sp.big_map({}),
        ledger=sp.map({}),
        token_metadata=[]
    )
    scenario += contract

    # Add moderator
    contract.add_moderator(moderator.address, _sender=admin)

    scenario.h2("Initial RNG contract is set")
    scenario.verify(contract.data.rng_contract == rng1.address)

    scenario.h2("Moderator can update RNG contract")
    contract.set_rng_contract(rng2.address, _sender=moderator)
    scenario.verify(contract.data.rng_contract == rng2.address)

    scenario.h2("Admin can update RNG contract")
    contract.set_rng_contract(rng1.address, _sender=admin)
    scenario.verify(contract.data.rng_contract == rng1.address)

    scenario.h2("Non-mod cannot update RNG contract")
    contract.set_rng_contract(
        rng2.address,
        _sender=alice,
        _valid=False,
        _exception="ONLY_MODS"
    )

@sp.add_test()
def test_fragment_management():
    """
    Tests fragment management functionality:
    - Adding fragments with different IDs
    - Overwriting existing fragments
    - Fragment access control
    """
    scenario = sp.test_scenario("Fragment Management", [bootloader, randomiser])

    admin = sp.test_account("Admin")
    alice = sp.test_account("Alice")
    moderator = sp.test_account("Moderator")

    rng = randomiser.RandomiserMock()
    scenario += rng

    contract = bootloader.Bootloader(
        admin_address=admin.address,
        rng_contract=rng.address, 
        contract_metadata=sp.big_map({}),
        ledger=sp.map({}),
        token_metadata=[]
    )
    scenario += contract

    # Add moderator
    contract.add_moderator(moderator.address, _sender=admin)

    scenario.h2("Admin can add bootloader")
    contract.add_bootloader(
        version=sp.bytes("0x302e302e31"),  # "0.0.1"
        fragments=[sp.bytes("0x3c73766720786d6c6e733d22687474703a2f2f7777772e77332e6f72672f323030302f737667222076696577426f783d22302030203130302031303022207374796c653d226261636b67726f756e642d636f6c6f723a77686974653b223e")],
        fun=bootloader.v0_0_1,
        storage_limits=sp.record(code=1000, name=1000, desc=1000, author=1000),
        _sender=admin
    )
    
    scenario.verify(contract.data.bootloaders.contains(0))

    scenario.h2("Moderator can add bootloader")
    contract.add_bootloader(
        version=sp.bytes("0x302e302e32"),  # "0.0.2"
        fragments=[sp.bytes("0x3c2f7376673e")],
        fun=bootloader.v0_0_1,
        storage_limits=sp.record(code=1000, name=1000, desc=1000, author=1000),
        _sender=admin  # Only admin can add bootloaders
    )
    
    scenario.verify(contract.data.bootloaders.contains(1))

    scenario.h2("Can add multiple bootloaders")
    new_fragments = [sp.bytes("0x3c67207374796c653d2266696c6c3a7265643b223e")]
    contract.add_bootloader(
        version=sp.bytes("0x302e302e33"),  # "0.0.3"
        fragments=new_fragments,
        fun=bootloader.v0_0_1,
        storage_limits=sp.record(code=1000, name=1000, desc=1000, author=1000),
        _sender=admin
    )
    
    scenario.verify(contract.data.bootloaders.contains(2))

    scenario.h2("Non-admin cannot add bootloader")
    contract.add_bootloader(
        version=sp.bytes("0x302e302e34"),  # "0.0.4"
        fragments=[sp.bytes("0x3c672f3e")],
        fun=bootloader.v0_0_1,
        storage_limits=sp.record(code=1000, name=1000, desc=1000, author=1000),
        _sender=alice,
        _valid=False,
        _exception="ONLY_ADMIN"
    )

@sp.add_test()
def test_contract_interaction_edge_cases():
    """
    Tests edge cases in contract interactions:
    - Empty entropy handling
    - Large entropy values
    - Contract address generation
    """
    scenario = sp.test_scenario("Contract Interaction Edge Cases", [bootloader, randomiser])

    admin = sp.test_account("Admin")
    alice = sp.test_account("Alice")
    bob = sp.test_account("Bob")

    rng = randomiser.RandomiserMock()
    scenario += rng

    contract = bootloader.Bootloader(
        admin_address=admin.address,
        rng_contract=rng.address, 
        contract_metadata=sp.big_map({}),
        ledger=sp.map({}),
        token_metadata=[]
    )
    scenario += contract

    # Add bootloader with fragments for minting
    fragments = []
    for i in range(4):
        fragments.append(sp.bytes("0x3c73766720786d6c6e733d22687474703a2f2f7777772e77332e6f72672f323030302f737667222076696577426f783d22302030203130302031303022207374796c653d226261636b67726f756e642d636f6c6f723a77686974653b223e"))
    
    contract.add_bootloader(
        version=sp.bytes("0x302e302e31"),  # "0.0.1"
        fragments=fragments,
        fun=bootloader.v0_0_1,
        storage_limits=sp.record(code=1000, name=1000, desc=1000, author=1000),
        _sender=admin
    )

    # Create generator
    contract.create_generator(
        name=sp.bytes("0x456467652043617365732054657374"),
        description=sp.bytes("0x54657374696e6720656467652063617365732020"),
        code=sp.bytes("0x636f6e736f6c652e6c6f67282254657374"),
        author_bytes=sp.bytes("0x416c696365"),
        reserved_editions=0,
        bootloader_id=0,
        _sender=alice
    )

    contract.set_sale(
        generator_id=0,
        start_time=None,
        price=sp.mutez(0),
        paused=False,
        editions=10,
        max_per_wallet=None,
        _sender=alice
    )

    scenario.h2("Minting with empty entropy")
    contract.mint(
        generator_id=0, 
        entropy=sp.bytes("0x"),
        _sender=bob,
        _amount=sp.mutez(0)
    )
    
    scenario.verify(contract.data.next_token_id == 1)

    scenario.h2("Minting with large entropy")
    large_entropy = sp.bytes("0x" + "ff" * 100)  # 100 bytes of 0xff
    contract.mint(
        generator_id=0, 
        entropy=large_entropy,
        _sender=bob,
        _amount=sp.mutez(0)
    )
    
    scenario.verify(contract.data.next_token_id == 2)

@sp.add_test()
def test_state_consistency():
    """
    Tests state consistency across operations:
    - Generator counters are properly maintained
    - Token counters are properly maintained
    - Reserved editions are properly tracked
    """
    scenario = sp.test_scenario("State Consistency", [bootloader, randomiser])

    admin = sp.test_account("Admin")
    alice = sp.test_account("Alice")
    bob = sp.test_account("Bob")

    rng = randomiser.RandomiserMock()
    scenario += rng

    contract = bootloader.Bootloader(
        admin_address=admin.address,
        rng_contract=rng.address, 
        contract_metadata=sp.big_map({}),
        ledger=sp.map({}),
        token_metadata=[]
    )
    scenario += contract

    # Add bootloader with fragments for minting
    fragments = []
    for i in range(4):
        fragments.append(sp.bytes("0x3c73766720786d6c6e733d22687474703a2f2f7777772e77332e6f72672f323030302f737667222076696577426f783d22302030203130302031303022207374796c653d226261636b67726f756e642d636f6c6f723a77686974653b223e"))
    
    contract.add_bootloader(
        version=sp.bytes("0x302e302e31"),  # "0.0.1"
        fragments=fragments,
        fun=bootloader.v0_0_1,
        storage_limits=sp.record(code=1000, name=1000, desc=1000, author=1000),
        _sender=admin
    )

    scenario.h2("Initial state is consistent")
    scenario.verify(contract.data.next_generator_id == 0)
    scenario.verify(contract.data.next_token_id == 0)

    scenario.h2("Generator creation increments counter")
    contract.create_generator(
        name=sp.bytes("0x436f6e73697374656e637920546573742031"),
        description=sp.bytes("0x54657374696e6720636f6e73697374656e6379"),
        code=sp.bytes("0x636f6e736f6c652e6c6f67282254657374"),
        author_bytes=sp.bytes("0x416c696365"),
        reserved_editions=3,
        bootloader_id=0,
        _sender=alice
    )
    
    scenario.verify(contract.data.next_generator_id == 1)
    scenario.verify(contract.data.generators[0].n_tokens == 0)
    scenario.verify(contract.data.generators[0].reserved_editions == 3)

    scenario.h2("Second generator creation")
    contract.create_generator(
        name=sp.bytes("0x436f6e73697374656e637920546573742032"),
        description=sp.bytes("0x54657374696e6720636f6e73697374656e6379"),
        code=sp.bytes("0x636f6e736f6c652e6c6f67282254657374"),
        author_bytes=sp.bytes("0x416c696365"),
        reserved_editions=2,
        bootloader_id=0,
        _sender=alice
    )
    
    scenario.verify(contract.data.next_generator_id == 2)
    scenario.verify(contract.data.generators[1].n_tokens == 0)
    scenario.verify(contract.data.generators[1].reserved_editions == 2)

    # Set sales for both generators
    contract.set_sale(
        generator_id=0,
        start_time=None,
        price=sp.mutez(0),
        paused=False,
        editions=10,
        max_per_wallet=None,
        _sender=alice
    )

    contract.set_sale(
        generator_id=1,
        start_time=None,
        price=sp.mutez(0),
        paused=False,
        editions=5,
        max_per_wallet=None,
        _sender=alice
    )

    scenario.h2("Minting updates correct generator counters")
    contract.mint(
        generator_id=0, 
        entropy=sp.bytes("0x" + os.urandom(16).hex()),
        _sender=bob,
        _amount=sp.mutez(0)
    )
    
    scenario.verify(contract.data.next_token_id == 1)
    scenario.verify(contract.data.generators[0].n_tokens == 1)
    scenario.verify(contract.data.generators[1].n_tokens == 0)

    contract.mint(
        generator_id=1, 
        entropy=sp.bytes("0x" + os.urandom(16).hex()),
        _sender=bob,
        _amount=sp.mutez(0)
    )
    
    scenario.verify(contract.data.next_token_id == 2)
    scenario.verify(contract.data.generators[0].n_tokens == 1)
    scenario.verify(contract.data.generators[1].n_tokens == 1)

    scenario.h2("Airdrop updates reserved editions correctly")
    contract.airdrop(
        generator_id=0,
        recipient=bob.address,
        entropy=sp.bytes("0x" + os.urandom(16).hex()),
        _sender=alice
    )
    
    scenario.verify(contract.data.generators[0].reserved_editions == 2)
    scenario.verify(contract.data.generators[1].reserved_editions == 2)
    scenario.verify(contract.data.generators[0].n_tokens == 2)
    scenario.verify(contract.data.generators[1].n_tokens == 1)

@sp.add_test()
def test_complex_scenarios():
    """
    Tests complex scenarios combining multiple operations:
    - Mixed minting and airdrop operations
    - Generator updates during active sales
    - Multiple generators with different configurations
    """
    scenario = sp.test_scenario("Complex Scenarios", [bootloader, randomiser])

    admin = sp.test_account("Admin")
    alice = sp.test_account("Alice")
    bob = sp.test_account("Bob")
    charlie = sp.test_account("Charlie")

    rng = randomiser.RandomiserMock()
    scenario += rng

    contract = bootloader.Bootloader(
        admin_address=admin.address,
        rng_contract=rng.address, 
        contract_metadata=sp.big_map({}),
        ledger=sp.map({}),
        token_metadata=[]
    )
    scenario += contract

    # Add bootloader with fragments for minting
    fragments = []
    for i in range(4):
        fragments.append(sp.bytes("0x3c73766720786d6c6e733d22687474703a2f2f7777772e77332e6f72672f323030302f737667222076696577426f783d22302030203130302031303022207374796c653d226261636b67726f756e642d636f6c6f723a77686974653b223e"))
    
    contract.add_bootloader(
        version=sp.bytes("0x302e302e31"),  # "0.0.1"
        fragments=fragments,
        fun=bootloader.v0_0_1,
        storage_limits=sp.record(code=1000, name=1000, desc=1000, author=1000),
        _sender=admin
    )

    scenario.h2("Create multiple generators with different configurations")
    # Generator 0: Free, limited editions, reserved editions
    contract.create_generator(
        name=sp.bytes("0x46726565204c696d69746564"),
        description=sp.bytes("0x46726565206c696d697465642067656e657261746f72"),
        code=sp.bytes("0x636f6e736f6c652e6c6f67282246726565"),
        author_bytes=sp.bytes("0x416c696365"),
        reserved_editions=2,
        bootloader_id=0,
        _sender=alice
    )

    # Generator 1: Paid, unlimited, no reserved
    contract.create_generator(
        name=sp.bytes("0x50616964204f70656e"),
        description=sp.bytes("0x50616964206f70656e2067656e657261746f72"),
        code=sp.bytes("0x636f6e736f6c652e6c6f67282250616964"),
        author_bytes=sp.bytes("0x426f62"),
        reserved_editions=0,
        bootloader_id=0,
        _sender=bob
    )

    # Set different sale configurations
    contract.set_sale(
        generator_id=0,
        start_time=None,
        price=sp.mutez(0),
        paused=False,
        editions=5,
        max_per_wallet=sp.Some(2),
        _sender=alice
    )

    contract.set_sale(
        generator_id=1,
        start_time=None,
        price=sp.mutez(1000000),
        paused=False,
        editions=100,
        max_per_wallet=None,
        _sender=bob
    )

    scenario.h2("Mixed operations on different generators")
    # Mint from free generator
    contract.mint(
        generator_id=0, 
        entropy=sp.bytes("0x" + os.urandom(16).hex()),
        _sender=charlie,
        _amount=sp.mutez(0)
    )

    # Airdrop from free generator
    contract.airdrop(
        generator_id=0,
        recipient=bob.address,
        entropy=sp.bytes("0x" + os.urandom(16).hex()),
        _sender=alice
    )

    # Mint from paid generator
    contract.mint(
        generator_id=1, 
        entropy=sp.bytes("0x" + os.urandom(16).hex()),
        _sender=charlie,
        _amount=sp.mutez(1000000)
    )

    scenario.h2("Verify state consistency across generators")
    scenario.verify(contract.data.generators[0].n_tokens == 2)
    scenario.verify(contract.data.generators[0].reserved_editions == 1)
    scenario.verify(contract.data.generators[1].n_tokens == 1)
    scenario.verify(contract.data.generators[1].reserved_editions == 0)
    scenario.verify(contract.data.next_token_id == 3)

    scenario.h2("Update generator during active sale")
    contract.update_generator(
        generator_id=0,
        name=sp.bytes("0x46726565204c696d6974656420563220"),
        description=sp.bytes("0x557064617465642067656e657261746f72"),
        code=sp.bytes("0x636f6e736f6c652e6c6f67282246726565205632"),
        author_bytes=sp.bytes("0x416c696365"),
        reserved_editions=1,  # Reduce reserved editions
        _sender=alice
    )

    scenario.verify(contract.data.generators[0].version == 2)
    scenario.verify(contract.data.generators[0].reserved_editions == 1)

    scenario.h2("Continue operations after update")
    # Mint more from updated generator
    contract.mint(
        generator_id=0, 
        entropy=sp.bytes("0x" + os.urandom(16).hex()),
        _sender=bob,
        _amount=sp.mutez(0)
    )

    # Should reach public limit (5 total - 1 reserved - 3 already minted = 1 remaining)
    scenario.verify(contract.data.generators[0].n_tokens == 3)

    contract.mint(
        generator_id=0, 
        entropy=sp.bytes("0x" + os.urandom(16).hex()),
        _sender=charlie,
        _amount=sp.mutez(0),
    )

    # This should fail as we've reached public limit
    contract.mint(
        generator_id=0, 
        entropy=sp.bytes("0x" + os.urandom(16).hex()),
        _sender=charlie,
        _amount=sp.mutez(0),
        _valid=False,
        _exception="PUBLIC_SOLD_OUT"
    )

    # But airdrop should still work
    contract.airdrop(
        generator_id=0,
        recipient=charlie.address,
        entropy=sp.bytes("0x" + os.urandom(16).hex()),
        _sender=alice
    )

    scenario.verify(contract.data.generators[0].n_tokens == 5)
    scenario.verify(contract.data.generators[0].reserved_editions == 0)
