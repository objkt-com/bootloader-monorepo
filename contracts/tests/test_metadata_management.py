"""
Metadata Management Tests

This module tests contract metadata management functionality:
- Admin can set contract metadata
- Non-admin cannot set metadata
- Metadata updates work correctly
- Multiple metadata updates
- Edge cases and validation
"""

from bootloader import bootloader
from randomiser import randomiser
import smartpy as sp
import os

@sp.add_test()
def test_basic_metadata_setting():
    """
    Tests basic metadata setting functionality:
    - Admin can set metadata
    - Non-admin cannot set metadata
    - Metadata is stored correctly
    """
    scenario = sp.test_scenario("Basic Metadata Setting", [bootloader, randomiser])

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

    scenario.h2("Admin can set metadata")
    metadata_updates = {
        "name": sp.bytes("0x426f6f746c6f61646572204e4654"),  # "Bootloader NFT"
        "description": sp.bytes("0x47656e657261746976652041727420506c6174666f726d"),  # "Generative Art Platform"
        "version": sp.bytes("0x76312e302e30"),  # "v1.0.0"
        "author": sp.bytes("0x4f626a6b74204c616273"),  # "Objkt Labs"
    }

    contract.set_metadata(
        metadata_updates,
        _sender=admin
    )

    scenario.h2("Metadata is stored correctly")
    scenario.verify(contract.data.metadata["name"] == sp.bytes("0x426f6f746c6f61646572204e4654"))
    scenario.verify(contract.data.metadata["description"] == sp.bytes("0x47656e657261746976652041727420506c6174666f726d"))
    scenario.verify(contract.data.metadata["version"] == sp.bytes("0x76312e302e30"))
    scenario.verify(contract.data.metadata["author"] == sp.bytes("0x4f626a6b74204c616273"))

    scenario.h2("Non-admin cannot set metadata")
    contract.set_metadata(
        {"unauthorized": sp.bytes("0x756e617574686f72697a6564")},
        _sender=alice,
        _valid=False,
        _exception="ONLY_ADMIN"
    )

@sp.add_test()
def test_metadata_updates():
    """
    Tests metadata update functionality:
    - Can update existing metadata keys
    - Can add new metadata keys
    - Updates don't affect other keys
    """
    scenario = sp.test_scenario("Metadata Updates", [bootloader, randomiser])

    admin = sp.test_account("Admin")

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

    scenario.h2("Set initial metadata")
    initial_metadata = {
        "name": sp.bytes("0x426f6f746c6f61646572"),  # "Bootloader"
        "version": sp.bytes("0x76302e312e30"),  # "v0.1.0"
    }

    contract.set_metadata(
        initial_metadata,
        _sender=admin
    )

    scenario.verify(contract.data.metadata["name"] == sp.bytes("0x426f6f746c6f61646572"))
    scenario.verify(contract.data.metadata["version"] == sp.bytes("0x76302e312e30"))

    scenario.h2("Update existing key and add new key")
    update_metadata = {
        "version": sp.bytes("0x76312e302e30"),  # "v1.0.0" - update existing
        "description": sp.bytes("0x4e465420506c6174666f726d"),  # "NFT Platform" - new key
    }

    contract.set_metadata(
        update_metadata,
        _sender=admin
    )

    scenario.h2("Existing key is updated, new key is added, other keys unchanged")
    scenario.verify(contract.data.metadata["name"] == sp.bytes("0x426f6f746c6f61646572"))  # unchanged
    scenario.verify(contract.data.metadata["version"] == sp.bytes("0x76312e302e30"))  # updated
    scenario.verify(contract.data.metadata["description"] == sp.bytes("0x4e465420506c6174666f726d"))  # new

@sp.add_test()
def test_multiple_metadata_updates():
    """
    Tests multiple metadata updates in sequence:
    - Multiple updates work correctly
    - Each update is independent
    - Metadata accumulates correctly
    """
    scenario = sp.test_scenario("Multiple Metadata Updates", [bootloader, randomiser])

    admin = sp.test_account("Admin")

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

    scenario.h2("First update")
    contract.set_metadata(
        {"name": sp.bytes("0x426f6f746c6f61646572")},
        _sender=admin
    )
    scenario.verify(contract.data.metadata["name"] == sp.bytes("0x426f6f746c6f61646572"))

    scenario.h2("Second update")
    contract.set_metadata(
        {"version": sp.bytes("0x76312e302e30")},
        _sender=admin
    )
    scenario.verify(contract.data.metadata["name"] == sp.bytes("0x426f6f746c6f61646572"))
    scenario.verify(contract.data.metadata["version"] == sp.bytes("0x76312e302e30"))

    scenario.h2("Third update")
    contract.set_metadata(
        {"author": sp.bytes("0x4f626a6b74204c616273")},
        _sender=admin
    )
    scenario.verify(contract.data.metadata["name"] == sp.bytes("0x426f6f746c6f61646572"))
    scenario.verify(contract.data.metadata["version"] == sp.bytes("0x76312e302e30"))
    scenario.verify(contract.data.metadata["author"] == sp.bytes("0x4f626a6b74204c616273"))

    scenario.h2("Fourth update - modify existing")
    contract.set_metadata(
        {"name": sp.bytes("0x426f6f746c6f61646572204e4654")},
        _sender=admin
    )
    scenario.verify(contract.data.metadata["name"] == sp.bytes("0x426f6f746c6f61646572204e4654"))
    scenario.verify(contract.data.metadata["version"] == sp.bytes("0x76312e302e30"))
    scenario.verify(contract.data.metadata["author"] == sp.bytes("0x4f626a6b74204c616273"))

@sp.add_test()
def test_empty_metadata_updates():
    """
    Tests edge cases with empty metadata:
    - Empty update map
    - Empty string values
    - Empty bytes values
    """
    scenario = sp.test_scenario("Empty Metadata Updates", [bootloader, randomiser])

    admin = sp.test_account("Admin")

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

    scenario.h2("Empty update map should work")
    contract.set_metadata(
        {},
        _sender=admin
    )

    scenario.h2("Empty bytes values should work")
    contract.set_metadata(
        {
            "empty_field": sp.bytes("0x"),
            "normal_field": sp.bytes("0x76616c7565")  # "value"
        },
        _sender=admin
    )
    scenario.verify(contract.data.metadata["empty_field"] == sp.bytes("0x"))
    scenario.verify(contract.data.metadata["normal_field"] == sp.bytes("0x76616c7565"))

@sp.add_test()
def test_large_metadata_values():
    """
    Tests metadata with large values:
    - Large byte strings
    - Many metadata keys
    - Complex metadata structures
    """
    scenario = sp.test_scenario("Large Metadata Values", [bootloader, randomiser])

    admin = sp.test_account("Admin")

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

    scenario.h2("Set large metadata values")
    large_description = sp.bytes("0x" + "41" * 1000)  # 1000 bytes of 'A'
    large_json = sp.bytes("0x7b226e616d65223a22426f6f746c6f61646572222c226465736372697074696f6e223a2247656e657261746976652041727420506c6174666f726d222c2276657273696f6e223a2276312e302e30222c22617574686f72223a224f626a6b74204c616273227d")  # JSON metadata

    large_metadata = {
        "name": sp.bytes("0x426f6f746c6f61646572204e4654"),
        "description": large_description,
        "interfaces": sp.bytes("0x5b2254455a4f532d464132225d"),  # ["TEZOS-FA2"]
        "json_metadata": large_json,
        "symbol": sp.bytes("0x424f4f544c"),  # "BOOTL"
        "decimals": sp.bytes("0x30"),  # "0"
    }

    contract.set_metadata(
        large_metadata,
        _sender=admin
    )

    scenario.h2("Large metadata is stored correctly")
    scenario.verify(contract.data.metadata["name"] == sp.bytes("0x426f6f746c6f61646572204e4654"))
    scenario.verify(contract.data.metadata["description"] == large_description)
    scenario.verify(contract.data.metadata["interfaces"] == sp.bytes("0x5b2254455a4f532d464132225d"))
    scenario.verify(contract.data.metadata["json_metadata"] == large_json)
    scenario.verify(contract.data.metadata["symbol"] == sp.bytes("0x424f4f544c"))
    scenario.verify(contract.data.metadata["decimals"] == sp.bytes("0x30"))

@sp.add_test()
def test_metadata_overwrite():
    """
    Tests metadata overwriting behavior:
    - Overwriting existing keys
    - Partial updates don't remove other keys
    - Complete metadata replacement scenarios
    """
    scenario = sp.test_scenario("Metadata Overwrite", [bootloader, randomiser])

    admin = sp.test_account("Admin")

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

    scenario.h2("Set initial comprehensive metadata")
    initial_metadata = {
        "name": sp.bytes("0x4f6c6420426f6f746c6f61646572"),  # "Old Bootloader"
        "version": sp.bytes("0x76302e312e30"),  # "v0.1.0"
        "author": sp.bytes("0x4f6c6420417574686f72"),  # "Old Author"
        "description": sp.bytes("0x4f6c64204465736372697074696f6e"),  # "Old Description"
    }

    contract.set_metadata(
        initial_metadata,
        _sender=admin
    )

    scenario.h2("Overwrite some keys, keep others")
    overwrite_metadata = {
        "name": sp.bytes("0x4e657720426f6f746c6f61646572"),  # "New Bootloader"
        "version": sp.bytes("0x76322e302e30"),  # "v2.0.0"
        # Note: not updating author and description
    }

    contract.set_metadata(
        overwrite_metadata,
        _sender=admin
    )

    scenario.h2("Updated keys are changed, others remain")
    scenario.verify(contract.data.metadata["name"] == sp.bytes("0x4e657720426f6f746c6f61646572"))  # updated
    scenario.verify(contract.data.metadata["version"] == sp.bytes("0x76322e302e30"))  # updated
    scenario.verify(contract.data.metadata["author"] == sp.bytes("0x4f6c6420417574686f72"))  # unchanged
    scenario.verify(contract.data.metadata["description"] == sp.bytes("0x4f6c64204465736372697074696f6e"))  # unchanged

    scenario.h2("Add new key while keeping existing")
    contract.set_metadata(
        {"license": sp.bytes("0x4d4954")},  # "MIT"
        _sender=admin
    )

    scenario.verify(contract.data.metadata["name"] == sp.bytes("0x4e657720426f6f746c6f61646572"))
    scenario.verify(contract.data.metadata["version"] == sp.bytes("0x76322e302e30"))
    scenario.verify(contract.data.metadata["author"] == sp.bytes("0x4f6c6420417574686f72"))
    scenario.verify(contract.data.metadata["description"] == sp.bytes("0x4f6c64204465736372697074696f6e"))
    scenario.verify(contract.data.metadata["license"] == sp.bytes("0x4d4954"))

@sp.add_test()
def test_metadata_with_special_characters():
    """
    Tests metadata with special characters and encoding:
    - Unicode characters
    - Special symbols
    - JSON-like structures
    - URL encoding
    """
    scenario = sp.test_scenario("Metadata with Special Characters", [bootloader, randomiser])

    admin = sp.test_account("Admin")

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

    scenario.h2("Set metadata with special characters")
    special_metadata = {
        # JSON structure
        "json": sp.bytes("0x7b226e616d65223a22426f6f746c6f61646572222c2273796d626f6c223a22f09f9a80227d"),  # {"name":"Bootloader","symbol":"🚀"}
        # URL
        "homepage": sp.bytes("0x68747470733a2f2f626f6f746c6f616465722e6172742f"),  # "https://bootloader.art/"
        # Special symbols
        "symbols": sp.bytes("0xe29c85e29c93e29c97"),  # "✅✓✗"
        # Numbers and mixed content
        "mixed": sp.bytes("0x56657273696f6e20312e302e302028323032342d30312d303129"),  # "Version 1.0.0 (2024-01-01)"
    }

    contract.set_metadata(
        special_metadata,
        _sender=admin
    )

    scenario.h2("Special character metadata is stored correctly")
    scenario.verify(contract.data.metadata["json"] == sp.bytes("0x7b226e616d65223a22426f6f746c6f61646572222c2273796d626f6c223a22f09f9a80227d"))
    scenario.verify(contract.data.metadata["homepage"] == sp.bytes("0x68747470733a2f2f626f6f746c6f616465722e6172742f"))
    scenario.verify(contract.data.metadata["symbols"] == sp.bytes("0xe29c85e29c93e29c97"))
    scenario.verify(contract.data.metadata["mixed"] == sp.bytes("0x56657273696f6e20312e302e302028323032342d30312d303129"))

@sp.add_test()
def test_metadata_access_control():
    """
    Tests metadata access control edge cases:
    - Only admin can modify metadata
    - Moderators cannot modify metadata
    - Multiple admin attempts
    """
    scenario = sp.test_scenario("Metadata Access Control", [bootloader, randomiser])

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

    scenario.h2("Admin can set metadata")
    contract.set_metadata(
        {"admin_field": sp.bytes("0x61646d696e")},
        _sender=admin
    )
    scenario.verify(contract.data.metadata["admin_field"] == sp.bytes("0x61646d696e"))

    scenario.h2("Moderator cannot set metadata")
    contract.set_metadata(
        {"mod_field": sp.bytes("0x6d6f64")},
        _sender=moderator,
        _valid=False,
        _exception="ONLY_ADMIN"
    )

    scenario.h2("Regular user cannot set metadata")
    contract.set_metadata(
        {"user_field": sp.bytes("0x75736572")},
        _sender=alice,
        _valid=False,
        _exception="ONLY_ADMIN"
    )

    scenario.h2("Admin can still modify after adding moderators")
    contract.set_metadata(
        {"admin_field2": sp.bytes("0x61646d696e32")},
        _sender=admin
    )
    scenario.verify(contract.data.metadata["admin_field2"] == sp.bytes("0x61646d696e32"))
