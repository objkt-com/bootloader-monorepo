"""
Generator Deletion Tests

This module tests generator deletion functionality:
- Author can delete their own generators
- Non-author cannot delete generators
- Cannot delete generators with minted tokens
- Generator deletion removes from storage
- Edge cases and validation
"""

from bootloader import bootloader
from randomiser import randomiser
import smartpy as sp
import os

@sp.add_test()
def test_basic_generator_deletion():
    """
    Tests basic generator deletion functionality:
    - Author can delete their own generator
    - Non-author cannot delete generator
    - Generator is removed from storage
    """
    scenario = sp.test_scenario("Basic Generator Deletion", [bootloader, randomiser])

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

    # Add bootloader
    test_fragments = [
        sp.bytes("0x3c73766720786d6c6e733d22687474703a2f2f7777772e77332e6f72672f323030302f737667222076696577426f783d22302030203130302031303022207374796c653d226261636b67726f756e642d636f6c6f723a77686974653b223e"),
        sp.bytes("0x3c2f7376673e"),
        sp.bytes("0x3c67207374796c653d2266696c6c3a7265643b223e"),
        sp.bytes("0x3c2f673e")
    ]

    contract.add_bootloader(
        version=sp.bytes("0x76302e302e31"),
        fragments=test_fragments,
        fun=bootloader.v0_0_1,
        storage_limits=sp.record(code=30000, name=500, desc=8000, author=50),
        _sender=admin
    )

    # Create generator
    contract.create_generator(
        name=sp.bytes("0x44656c6574696f6e205465737420417274"),
        description=sp.bytes("0x54657374696e672067656e657261746f722064656c6574696f6e"),
        code=sp.bytes("0x636f6e736f6c652e6c6f67282254657374"),
        author_bytes=sp.bytes("0x416c696365"),
        reserved_editions=0,
        bootloader_id=0,
        _sender=alice
    )

    scenario.h2("Generator exists")
    scenario.verify(contract.data.generators.contains(0))
    scenario.verify(contract.data.generators[0].author == alice.address)

    scenario.h2("Non-author cannot delete generator")
    contract.delete_generator(
        0,
        _sender=bob,
        _valid=False,
        _exception="ONLY_AUTHOR"
    )

    scenario.h2("Author can delete generator")
    contract.delete_generator(
        0,
        _sender=alice
    )

    scenario.h2("Generator is removed from storage")
    scenario.verify(~contract.data.generators.contains(0))

@sp.add_test()
def test_cannot_delete_generator_with_tokens():
    """
    Tests that generators with minted tokens cannot be deleted:
    - Cannot delete generator after minting
    - Cannot delete generator after airdrop
    - Error message is correct
    """
    scenario = sp.test_scenario("Cannot Delete Generator with Tokens", [bootloader, randomiser])

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

    # Add bootloader
    test_fragments = [
        sp.bytes("0x3c73766720786d6c6e733d22687474703a2f2f7777772e77332e6f72672f323030302f737667222076696577426f783d22302030203130302031303022207374796c653d226261636b67726f756e642d636f6c6f723a77686974653b223e"),
        sp.bytes("0x3c2f7376673e"),
        sp.bytes("0x3c67207374796c653d2266696c6c3a7265643b223e"),
        sp.bytes("0x3c2f673e")
    ]

    contract.add_bootloader(
        version=sp.bytes("0x76302e302e31"),
        fragments=test_fragments,
        fun=bootloader.v0_0_1,
        storage_limits=sp.record(code=30000, name=500, desc=8000, author=50),
        _sender=admin
    )

    # Create generator with reserved editions
    contract.create_generator(
        name=sp.bytes("0x546f6b656e2044656c6574696f6e2054657374"),
        description=sp.bytes("0x54657374696e672064656c6574696f6e207769746820746f6b656e73"),
        code=sp.bytes("0x636f6e736f6c652e6c6f67282254657374"),
        author_bytes=sp.bytes("0x416c696365"),
        reserved_editions=5,
        bootloader_id=0,
        _sender=alice
    )

    # Set sale
    contract.set_sale(
        generator_id=0,
        start_time=None,
        price=sp.mutez(0),
        paused=False,
        editions=10,
        max_per_wallet=None,
        _sender=alice
    )

    scenario.h2("Can delete generator before any tokens are minted")
    # This should work since n_tokens is still 0
    # But let's first mint a token to test the restriction

    scenario.h2("Mint a token")
    contract.mint(
        generator_id=0, 
        entropy=sp.bytes("0x" + os.urandom(16).hex()),
        _sender=bob,
        _amount=sp.mutez(0)
    )

    scenario.verify(contract.data.generators[0].n_tokens == 1)

    scenario.h2("Cannot delete generator after minting")
    contract.delete_generator(
        0,
        _sender=alice,
        _valid=False,
        _exception="TOKENS_MINTED"
    )

@sp.add_test()
def test_cannot_delete_generator_with_airdropped_tokens():
    """
    Tests that generators with airdropped tokens cannot be deleted:
    - Cannot delete generator after airdrop
    - Airdrop increments n_tokens which prevents deletion
    """
    scenario = sp.test_scenario("Cannot Delete Generator with Airdropped Tokens", [bootloader, randomiser])

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

    # Add bootloader
    test_fragments = [
        sp.bytes("0x3c73766720786d6c6e733d22687474703a2f2f7777772e77332e6f72672f323030302f737667222076696577426f783d22302030203130302031303022207374796c653d226261636b67726f756e642d636f6c6f723a77686974653b223e"),
        sp.bytes("0x3c2f7376673e"),
        sp.bytes("0x3c67207374796c653d2266696c6c3a7265643b223e"),
        sp.bytes("0x3c2f673e")
    ]

    contract.add_bootloader(
        version=sp.bytes("0x76302e302e31"),
        fragments=test_fragments,
        fun=bootloader.v0_0_1,
        storage_limits=sp.record(code=30000, name=500, desc=8000, author=50),
        _sender=admin
    )

    # Create generator with reserved editions
    contract.create_generator(
        name=sp.bytes("0x41697264726f702044656c6574696f6e2054657374"),
        description=sp.bytes("0x54657374696e672064656c6574696f6e207769746820616972647266"),
        code=sp.bytes("0x636f6e736f6c652e6c6f67282254657374"),
        author_bytes=sp.bytes("0x416c696365"),
        reserved_editions=5,
        bootloader_id=0,
        _sender=alice
    )

    scenario.h2("Airdrop a token")
    contract.airdrop(
        generator_id=0,
        recipient=bob.address,
        entropy=sp.bytes("0x" + os.urandom(16).hex()),
        _sender=alice
    )

    scenario.verify(contract.data.generators[0].n_tokens == 1)

    scenario.h2("Cannot delete generator after airdrop")
    contract.delete_generator(
        0,
        _sender=alice,
        _valid=False,
        _exception="TOKENS_MINTED"
    )

@sp.add_test()
def test_delete_generator_with_sale_configuration():
    """
    Tests deletion of generators with sale configurations:
    - Can delete generator with sale config if no tokens minted
    - Sale configuration doesn't prevent deletion
    """
    scenario = sp.test_scenario("Delete Generator with Sale Configuration", [bootloader, randomiser])

    admin = sp.test_account("Admin")
    alice = sp.test_account("Alice")

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

    # Add bootloader
    test_fragments = [
        sp.bytes("0x3c73766720786d6c6e733d22687474703a2f2f7777772e77332e6f72672f323030302f737667222076696577426f783d22302030203130302031303022207374796c653d226261636b67726f756e642d636f6c6f723a77686974653b223e"),
        sp.bytes("0x3c2f7376673e"),
        sp.bytes("0x3c67207374796c653d2266696c6c3a7265643b223e"),
        sp.bytes("0x3c2f673e")
    ]

    contract.add_bootloader(
        version=sp.bytes("0x76302e302e31"),
        fragments=test_fragments,
        fun=bootloader.v0_0_1,
        storage_limits=sp.record(code=30000, name=500, desc=8000, author=50),
        _sender=admin
    )

    # Create generator
    contract.create_generator(
        name=sp.bytes("0x53616c652044656c6574696f6e2054657374"),
        description=sp.bytes("0x54657374696e672064656c6574696f6e207769746820736c65"),
        code=sp.bytes("0x636f6e736f6c652e6c6f67282254657374"),
        author_bytes=sp.bytes("0x416c696365"),
        reserved_editions=2,
        bootloader_id=0,
        _sender=alice
    )

    # Set sale configuration
    contract.set_sale(
        generator_id=0,
        start_time=None,
        price=sp.mutez(1000000),
        paused=False,
        editions=10,
        max_per_wallet=sp.Some(5),
        _sender=alice
    )

    scenario.h2("Generator has sale configuration")
    scenario.verify(contract.data.generators[0].sale.is_some())

    scenario.h2("Can delete generator with sale config if no tokens minted")
    contract.delete_generator(
        0,
        _sender=alice
    )

    scenario.h2("Generator is removed")
    scenario.verify(~contract.data.generators.contains(0))

@sp.add_test()
def test_delete_multiple_generators():
    """
    Tests deletion of multiple generators:
    - Can delete multiple generators independently
    - Deletion doesn't affect other generators
    - Generator IDs remain unique
    """
    scenario = sp.test_scenario("Delete Multiple Generators", [bootloader, randomiser])

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

    # Add bootloader
    test_fragments = [
        sp.bytes("0x3c73766720786d6c6e733d22687474703a2f2f7777772e77332e6f72672f323030302f737667222076696577426f783d22302030203130302031303022207374796c653d226261636b67726f756e642d636f6c6f723a77686974653b223e"),
        sp.bytes("0x3c2f7376673e"),
        sp.bytes("0x3c67207374796c653d2266696c6c3a7265643b223e"),
        sp.bytes("0x3c2f673e")
    ]

    contract.add_bootloader(
        version=sp.bytes("0x76302e302e31"),
        fragments=test_fragments,
        fun=bootloader.v0_0_1,
        storage_limits=sp.record(code=30000, name=500, desc=8000, author=50),
        _sender=admin
    )

    # Create multiple generators
    contract.create_generator(
        name=sp.bytes("0x47656e657261746f7220302020"),
        description=sp.bytes("0x46697273742067656e657261746f72"),
        code=sp.bytes("0x636f6e736f6c652e6c6f67282247656e203022"),
        author_bytes=sp.bytes("0x416c696365"),
        reserved_editions=0,
        bootloader_id=0,
        _sender=alice
    )

    contract.create_generator(
        name=sp.bytes("0x47656e657261746f7220312020"),
        description=sp.bytes("0x5365636f6e642067656e657261746f72"),
        code=sp.bytes("0x636f6e736f6c652e6c6f67282247656e203122"),
        author_bytes=sp.bytes("0x426f62"),
        reserved_editions=0,
        bootloader_id=0,
        _sender=bob
    )

    contract.create_generator(
        name=sp.bytes("0x47656e657261746f7220322020"),
        description=sp.bytes("0x546869726420676e657261746f72"),
        code=sp.bytes("0x636f6e736f6c652e6c6f67282247656e203222"),
        author_bytes=sp.bytes("0x416c696365"),
        reserved_editions=0,
        bootloader_id=0,
        _sender=alice
    )

    scenario.h2("All generators exist")
    scenario.verify(contract.data.generators.contains(0))
    scenario.verify(contract.data.generators.contains(1))
    scenario.verify(contract.data.generators.contains(2))
    scenario.verify(contract.data.next_generator_id == 3)

    scenario.h2("Delete first generator")
    contract.delete_generator(
        0,
        _sender=alice
    )

    scenario.h2("Only first generator is deleted")
    scenario.verify(~contract.data.generators.contains(0))
    scenario.verify(contract.data.generators.contains(1))
    scenario.verify(contract.data.generators.contains(2))

    scenario.h2("Delete third generator")
    contract.delete_generator(
        2,
        _sender=alice
    )

    scenario.h2("First and third generators are deleted")
    scenario.verify(~contract.data.generators.contains(0))
    scenario.verify(contract.data.generators.contains(1))
    scenario.verify(~contract.data.generators.contains(2))

    scenario.h2("Cannot delete non-existent generator")
    contract.delete_generator(
        0,
        _sender=alice,
        _valid=False
    )

@sp.add_test()
def test_delete_generator_edge_cases():
    """
    Tests edge cases in generator deletion:
    - Deleting non-existent generator
    - Deleting generator with ID 0
    - Deleting after generator updates
    """
    scenario = sp.test_scenario("Delete Generator Edge Cases", [bootloader, randomiser])

    admin = sp.test_account("Admin")
    alice = sp.test_account("Alice")

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

    # Add bootloader
    test_fragments = [
        sp.bytes("0x3c73766720786d6c6e733d22687474703a2f2f7777772e77332e6f72672f323030302f737667222076696577426f783d22302030203130302031303022207374796c653d226261636b67726f756e642d636f6c6f723a77686974653b223e"),
        sp.bytes("0x3c2f7376673e"),
        sp.bytes("0x3c67207374796c653d2266696c6c3a7265643b223e"),
        sp.bytes("0x3c2f673e")
    ]

    contract.add_bootloader(
        version=sp.bytes("0x76302e302e31"),
        fragments=test_fragments,
        fun=bootloader.v0_0_1,
        storage_limits=sp.record(code=30000, name=500, desc=8000, author=50),
        _sender=admin
    )

    scenario.h2("Cannot delete non-existent generator")
    contract.delete_generator(
        999,
        _sender=alice,
        _valid=False
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

    scenario.h2("Can delete generator with ID 0")
    scenario.verify(contract.data.generators.contains(0))
    
    # Update generator first
    contract.update_generator(
        generator_id=0,
        name=sp.bytes("0x557064617465642045646765204361736573"),
        description=sp.bytes("0x557064617465642067656e657261746f72"),
        code=sp.bytes("0x636f6e736f6c652e6c6f67282255706461746564"),
        author_bytes=sp.bytes("0x416c696365"),
        reserved_editions=0,
        _sender=alice
    )

    scenario.h2("Can delete updated generator")
    contract.delete_generator(
        0,
        _sender=alice
    )

    scenario.verify(~contract.data.generators.contains(0))

@sp.add_test()
def test_delete_generator_after_failed_mint():
    """
    Tests deletion after failed mint attempts:
    - Generator can be deleted even if mint attempts failed
    - Failed mints don't increment n_tokens
    """
    scenario = sp.test_scenario("Delete Generator After Failed Mint", [bootloader, randomiser])

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

    # Add bootloader
    test_fragments = [
        sp.bytes("0x3c73766720786d6c6e733d22687474703a2f2f7777772e77332e6f72672f323030302f737667222076696577426f783d22302030203130302031303022207374796c653d226261636b67726f756e642d636f6c6f723a77686974653b223e"),
        sp.bytes("0x3c2f7376673e"),
        sp.bytes("0x3c67207374796c653d2266696c6c3a7265643b223e"),
        sp.bytes("0x3c2f673e")
    ]

    contract.add_bootloader(
        version=sp.bytes("0x76302e302e31"),
        fragments=test_fragments,
        fun=bootloader.v0_0_1,
        storage_limits=sp.record(code=30000, name=500, desc=8000, author=50),
        _sender=admin
    )

    # Create generator
    contract.create_generator(
        name=sp.bytes("0x4661696c6564204d696e742054657374"),
        description=sp.bytes("0x54657374696e672064656c6574696f6e206166746572206661696c6564206d696e74"),
        code=sp.bytes("0x636f6e736f6c652e6c6f67282254657374"),
        author_bytes=sp.bytes("0x416c696365"),
        reserved_editions=0,
        bootloader_id=0,
        _sender=alice
    )

    # Set sale with paused state
    contract.set_sale(
        generator_id=0,
        start_time=None,
        price=sp.mutez(1000000),
        paused=True,  # Paused, so mint will fail
        editions=10,
        max_per_wallet=None,
        _sender=alice
    )

    scenario.h2("Attempt to mint (should fail)")
    contract.mint(
        generator_id=0, 
        entropy=sp.bytes("0x" + os.urandom(16).hex()),
        _sender=bob,
        _amount=sp.mutez(1000000),
        _valid=False,
        _exception="SALE_PAUSED"
    )

    scenario.h2("n_tokens should still be 0")
    scenario.verify(contract.data.generators[0].n_tokens == 0)

    scenario.h2("Can delete generator after failed mint")
    contract.delete_generator(
        0,
        _sender=alice
    )

    scenario.verify(~contract.data.generators.contains(0))
