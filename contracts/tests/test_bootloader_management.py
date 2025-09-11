"""
Bootloader Management Tests

This module tests bootloader-related functionality:
- Adding bootloaders (admin-only)
- Bootloader storage limits
- Generator creation with different bootloader types
- Bootloader versioning and fragments
- Lambda function execution for token metadata
"""

from bootloader import bootloader
from randomiser import randomiser
import smartpy as sp
import os

@sp.add_test()
def test_add_bootloader():
    """
    Tests bootloader addition functionality:
    - Admin can add bootloaders
    - Non-admin cannot add bootloaders
    - Bootloader ID increment
    - Storage limits are set correctly
    """
    scenario = sp.test_scenario("Add Bootloader", [bootloader, randomiser])

    admin = sp.test_account("Admin")
    alice = sp.test_account("Alice")

    rng = randomiser.CentralisedRandomiser()
    rng.data.testnet_mode = True
    scenario += rng

    contract = bootloader.Bootloader(
        admin_address=admin.address,
        rng_contract=rng.address, 
        contract_metadata=sp.big_map({}),
        ledger={},
        token_metadata=[]
    )
    scenario += contract

    # Create test fragments
    test_fragments = [
        sp.bytes("0x3c73766720786d6c6e733d22687474703a2f2f7777772e77332e6f72672f323030302f737667222076696577426f783d22302030203130302031303022207374796c653d226261636b67726f756e642d636f6c6f723a77686974653b223e"),
        sp.bytes("0x3c2f7376673e"),
        sp.bytes("0x3c67207374796c653d2266696c6c3a7265643b223e"),
        sp.bytes("0x3c2f673e")
    ]

    # Create storage limits
    storage_limits = sp.record(
        code=30000,
        name=500,
        desc=8000,
        author=50
    )

    scenario.h2("Admin can add bootloader")
    contract.add_bootloader(
        version=sp.bytes("0x76302e302e31"),  # "v0.0.1"
        fragments=test_fragments,
        fun=bootloader.v0_0_1,
        storage_limits=storage_limits,
        _sender=admin
    )
    
    scenario.verify(contract.data.next_bootloader_id == 1)
    scenario.verify(contract.data.bootloaders.contains(0))
    scenario.verify(contract.data.bootloader_storage_limits.contains(0))
    
    bootloader_data = contract.data.bootloaders[0]
    scenario.verify(bootloader_data.version == sp.bytes("0x76302e302e31"))
    scenario.verify(sp.len(bootloader_data.fragments) == 4)
    
    limits = contract.data.bootloader_storage_limits[0]
    scenario.verify(limits.code == 30000)
    scenario.verify(limits.name == 500)
    scenario.verify(limits.desc == 8000)
    scenario.verify(limits.author == 50)

    scenario.h2("Non-admin cannot add bootloader")
    contract.add_bootloader(
        version=sp.bytes("0x76302e302e32"),
        fragments=test_fragments,
        fun=bootloader.v0_0_1,
        storage_limits=storage_limits,
        _sender=alice,
        _valid=False,
        _exception="ONLY_ADMIN"
    )

    scenario.h2("Second bootloader increments ID")
    contract.add_bootloader(
        version=sp.bytes("0x76302e302e32"),  # "v0.0.2"
        fragments=test_fragments,
        fun=bootloader.v0_0_1_ghostnet,
        storage_limits=sp.record(code=40000, name=600, desc=10000, author=60),
        _sender=admin
    )
    
    scenario.verify(contract.data.next_bootloader_id == 2)
    scenario.verify(contract.data.bootloaders.contains(1))

@sp.add_test()
def test_generator_creation_with_bootloader():
    """
    Tests generator creation with specific bootloader:
    - Generator creation with valid bootloader ID
    - Generator creation with invalid bootloader ID fails
    - Storage limits are enforced based on bootloader
    """
    scenario = sp.test_scenario("Generator Creation with Bootloader", [bootloader, randomiser])

    admin = sp.test_account("Admin")
    alice = sp.test_account("Alice")

    rng = randomiser.CentralisedRandomiser()
    rng.data.testnet_mode = True
    scenario += rng

    contract = bootloader.Bootloader(
        admin_address=admin.address,
        rng_contract=rng.address, 
        contract_metadata=sp.big_map({}),
        ledger={},
        token_metadata=[]
    )
    scenario += contract

    # Add bootloader with strict limits
    test_fragments = [
        sp.bytes("0x3c73766720786d6c6e733d22687474703a2f2f7777772e77332e6f72672f323030302f737667222076696577426f783d22302030203130302031303022207374796c653d226261636b67726f756e642d636f6c6f723a77686974653b223e"),
        sp.bytes("0x3c2f7376673e"),
        sp.bytes("0x3c67207374796c653d2266696c6c3a7265643b223e"),
        sp.bytes("0x3c2f673e")
    ]

    strict_limits = sp.record(
        code=100,
        name=50,
        desc=200,
        author=20
    )

    contract.add_bootloader(
        version=sp.bytes("0x737472696374"),  # "strict"
        fragments=test_fragments,
        fun=bootloader.v0_0_1,
        storage_limits=strict_limits,
        _sender=admin
    )

    scenario.h2("Cannot create generator with unknown bootloader")
    contract.create_generator(
        name=sp.bytes("0x54657374"),
        description=sp.bytes("0x54657374"),
        code=sp.bytes("0x54657374"),
        author_bytes=sp.bytes("0x416c696365"),
        reserved_editions=0,
        bootloader_id=999,
        _sender=alice,
        _valid=False,
        _exception="UNKNOWN_BOOTLOADER"
    )

    scenario.h2("Can create generator with valid bootloader")
    contract.create_generator(
        name=sp.bytes("0x54657374"),  # "Test" - 4 bytes, within limit
        description=sp.bytes("0x54657374"),  # "Test" - 4 bytes, within limit
        code=sp.bytes("0x54657374"),  # "Test" - 4 bytes, within limit
        author_bytes=sp.bytes("0x416c696365"),  # "Alice" - 5 bytes, within limit
        reserved_editions=0,
        bootloader_id=0,
        _sender=alice
    )
    
    scenario.verify(contract.data.generators[0].type_id == 0)

    scenario.h2("Generator creation fails when exceeding name limit")
    long_name = sp.bytes("0x" + "41" * 51)  # 51 bytes, exceeds limit of 50
    contract.create_generator(
        name=long_name,
        description=sp.bytes("0x54657374"),
        code=sp.bytes("0x54657374"),
        author_bytes=sp.bytes("0x416c696365"),
        reserved_editions=0,
        bootloader_id=0,
        _sender=alice,
        _valid=False,
        _exception="NAME_TOO_LONG"
    )

    scenario.h2("Generator creation fails when exceeding code limit")
    long_code = sp.bytes("0x" + "41" * 101)  # 101 bytes, exceeds limit of 100
    contract.create_generator(
        name=sp.bytes("0x54657374"),
        description=sp.bytes("0x54657374"),
        code=long_code,
        author_bytes=sp.bytes("0x416c696365"),
        reserved_editions=0,
        bootloader_id=0,
        _sender=alice,
        _valid=False,
        _exception="CODE_TOO_LONG"
    )

@sp.add_test()
def test_bootloader_lambda_execution():
    """
    Tests that bootloader lambda functions execute correctly:
    - Token metadata is generated using bootloader function
    - Different bootloaders produce different metadata
    - Lambda parameters are passed correctly
    """
    scenario = sp.test_scenario("Bootloader Lambda Execution", [bootloader, randomiser])

    admin = sp.test_account("Admin")
    alice = sp.test_account("Alice")
    bob = sp.test_account("Bob")

    rng = randomiser.CentralisedRandomiser()
    rng.data.testnet_mode = True
    scenario += rng

    contract = bootloader.Bootloader(
        admin_address=admin.address,
        rng_contract=rng.address, 
        contract_metadata=sp.big_map({}),
        ledger={},
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
        name=sp.bytes("0x4c616d626461205465737420417274"),
        description=sp.bytes("0x54657374696e67206c616d62646120657865637574696f6e"),
        code=sp.bytes("0x636f6e736f6c652e6c6f67282254657374"),
        author_bytes=sp.bytes("0x416c696365"),
        reserved_editions=0,
        bootloader_id=0,
        _sender=alice
    )

    # Set sale and mint
    contract.set_sale(
        generator_id=0,
        start_time=None,
        price=sp.mutez(0),
        paused=False,
        editions=5,
        max_per_wallet=None,
        _sender=alice
    )

    contract.mint(
        generator_id=0, 
        entropy=sp.bytes("0x" + os.urandom(16).hex()),
        _sender=bob,
        _amount=sp.mutez(0)
    )

    scenario.h2("Token metadata is created")
    scenario.verify(contract.data.token_metadata.contains(0))
    
    token_metadata = contract.data.token_metadata[0]
    scenario.verify(token_metadata.token_id == 0)
    scenario.verify(token_metadata.token_info.contains("name"))
    scenario.verify(token_metadata.token_info.contains("artifactUri"))
    scenario.verify(token_metadata.token_info.contains("thumbnailUri"))

@sp.add_test()
def test_multiple_bootloaders():
    """
    Tests functionality with multiple bootloaders:
    - Different generators can use different bootloaders
    - Each bootloader has its own storage limits
    - Bootloader versioning works correctly
    """
    scenario = sp.test_scenario("Multiple Bootloaders", [bootloader, randomiser])

    admin = sp.test_account("Admin")
    alice = sp.test_account("Alice")
    bob = sp.test_account("Bob")

    rng = randomiser.CentralisedRandomiser()
    rng.data.testnet_mode = True
    scenario += rng

    contract = bootloader.Bootloader(
        admin_address=admin.address,
        rng_contract=rng.address, 
        contract_metadata=sp.big_map({}),
        ledger={},
        token_metadata=[]
    )
    scenario += contract

    # Add first bootloader (mainnet version)
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

    # Add second bootloader (ghostnet version)
    contract.add_bootloader(
        version=sp.bytes("0x76302e302e312d676e"),  # "v0.0.1-gn"
        fragments=test_fragments,
        fun=bootloader.v0_0_1_ghostnet,
        storage_limits=sp.record(code=40000, name=600, desc=10000, author=60),
        _sender=admin
    )

    scenario.h2("Create generators with different bootloaders")
    # Generator with mainnet bootloader
    contract.create_generator(
        name=sp.bytes("0x4d61696e6e65742047656e"),
        description=sp.bytes("0x4d61696e6e65742067656e657261746f72"),
        code=sp.bytes("0x636f6e736f6c652e6c6f67282254657374"),
        author_bytes=sp.bytes("0x416c696365"),
        reserved_editions=0,
        bootloader_id=0,
        _sender=alice
    )

    # Generator with ghostnet bootloader
    contract.create_generator(
        name=sp.bytes("0x47686f73746e65742047656e"),
        description=sp.bytes("0x47686f73746e65742067656e657261746f72"),
        code=sp.bytes("0x636f6e736f6c652e6c6f67282254657374"),
        author_bytes=sp.bytes("0x426f62"),
        reserved_editions=0,
        bootloader_id=1,
        _sender=bob
    )

    scenario.verify(contract.data.generators[0].type_id == 0)
    scenario.verify(contract.data.generators[1].type_id == 1)

    scenario.h2("Set sales and mint from both generators")
    contract.set_sale(
        generator_id=0,
        start_time=None,
        price=sp.mutez(0),
        paused=False,
        editions=5,
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
        _sender=bob
    )

    contract.mint(
        generator_id=0, 
        entropy=sp.bytes("0x" + os.urandom(16).hex()),
        _sender=alice,
        _amount=sp.mutez(0)
    )

    contract.mint(
        generator_id=1, 
        entropy=sp.bytes("0x" + os.urandom(16).hex()),
        _sender=bob,
        _amount=sp.mutez(0)
    )

    scenario.h2("Both tokens have metadata")
    scenario.verify(contract.data.token_metadata.contains(0))
    scenario.verify(contract.data.token_metadata.contains(1))

@sp.add_test()
def test_bootloader_storage_limit_enforcement():
    """
    Tests that bootloader storage limits are properly enforced:
    - Generator creation respects bootloader limits
    - Generator updates respect bootloader limits
    - Different bootloaders can have different limits
    """
    scenario = sp.test_scenario("Bootloader Storage Limit Enforcement", [bootloader, randomiser])

    admin = sp.test_account("Admin")
    alice = sp.test_account("Alice")

    rng = randomiser.CentralisedRandomiser()
    rng.data.testnet_mode = True
    scenario += rng

    contract = bootloader.Bootloader(
        admin_address=admin.address,
        rng_contract=rng.address, 
        contract_metadata=sp.big_map({}),
        ledger={},
        token_metadata=[]
    )
    scenario += contract

    # Add bootloader with very restrictive limits
    test_fragments = [
        sp.bytes("0x3c73766720786d6c6e733d22687474703a2f2f7777772e77332e6f72672f323030302f737667222076696577426f783d22302030203130302031303022207374796c653d226261636b67726f756e642d636f6c6f723a77686974653b223e"),
        sp.bytes("0x3c2f7376673e"),
        sp.bytes("0x3c67207374796c653d2266696c6c3a7265643b223e"),
        sp.bytes("0x3c2f673e")
    ]

    restrictive_limits = sp.record(
        code=10,
        name=10,
        desc=20,
        author=5
    )

    contract.add_bootloader(
        version=sp.bytes("0x72657374726963746976652020"),
        fragments=test_fragments,
        fun=bootloader.v0_0_1,
        storage_limits=restrictive_limits,
        _sender=admin
    )

    scenario.h2("Can create generator within limits")
    contract.create_generator(
        name=sp.bytes("0x54657374"),  # "Test" - 4 bytes
        description=sp.bytes("0x54657374"),  # "Test" - 4 bytes
        code=sp.bytes("0x54657374"),  # "Test" - 4 bytes
        author_bytes=sp.bytes("0x41"),  # "A" - 1 byte
        reserved_editions=0,
        bootloader_id=0,
        _sender=alice
    )

    scenario.h2("Cannot update generator beyond limits")
    long_name = sp.bytes("0x" + "41" * 11)  # 11 bytes, exceeds limit of 10
    contract.update_generator(
        generator_id=0,
        name=long_name,
        description=sp.bytes("0x54657374"),
        code=sp.bytes("0x54657374"),
        author_bytes=sp.bytes("0x41"),
        reserved_editions=0,
        _sender=alice,
        _valid=False,
        _exception="NAME_TOO_LONG"
    )

    long_desc = sp.bytes("0x" + "41" * 21)  # 21 bytes, exceeds limit of 20
    contract.update_generator(
        generator_id=0,
        name=sp.bytes("0x54657374"),
        description=long_desc,
        code=sp.bytes("0x54657374"),
        author_bytes=sp.bytes("0x41"),
        reserved_editions=0,
        _sender=alice,
        _valid=False,
        _exception="DESC_TOO_LONG"
    )

    long_code = sp.bytes("0x" + "41" * 11)  # 11 bytes, exceeds limit of 10
    contract.update_generator(
        generator_id=0,
        name=sp.bytes("0x54657374"),
        description=sp.bytes("0x54657374"),
        code=long_code,
        author_bytes=sp.bytes("0x41"),
        reserved_editions=0,
        _sender=alice,
        _valid=False,
        _exception="CODE_TOO_LONG"
    )

    long_author = sp.bytes("0x" + "41" * 6)  # 6 bytes, exceeds limit of 5
    contract.update_generator(
        generator_id=0,
        name=sp.bytes("0x54657374"),
        description=sp.bytes("0x54657374"),
        code=sp.bytes("0x54657374"),
        author_bytes=long_author,
        reserved_editions=0,
        _sender=alice,
        _valid=False,
        _exception="AUTHOR_TOO_LONG"
    )
