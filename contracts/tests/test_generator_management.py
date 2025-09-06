"""
Generator Management Tests

This module tests all generator-related functionality:
- Creating generators with validation
- Updating generators (author-only)
- Input validation (name, description, code, author bytes length limits)
- Generator versioning
- Reserved editions handling
- Generator flagging by moderators
"""

from svgkt import svgkt
from randomiser import randomiser
import smartpy as sp
import os

@sp.add_test()
def test_generator_creation():
    """
    Tests basic generator creation functionality:
    - Successful generator creation
    - Generator ID increment
    - Initial generator state
    - Author assignment
    """
    scenario = sp.test_scenario("Generator Creation", [svgkt, randomiser])

    admin = sp.test_account("Admin")
    alice = sp.test_account("Alice")

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

    scenario.h2("Create first generator")
    contract.create_generator(
        name=sp.bytes("0x416c69636520417274"),
        description=sp.bytes("0x412062656175746966756c2067656e657261746f72"),
        code=sp.bytes("0x636f6e736f6c652e6c6f67282248656c6c6f20576f726c642229"),
        author_bytes=sp.bytes("0x416c696365"),
        reserved_editions=0,
        _sender=alice
    )
    
    scenario.verify(contract.data.next_generator_id == 1)
    scenario.verify(contract.data.generators.contains(0))
    generator = contract.data.generators[0]
    scenario.verify(generator.author == alice.address)
    scenario.verify(generator.n_tokens == 0)
    scenario.verify(generator.sale.is_none())
    scenario.verify(generator.version == 1)
    scenario.verify(generator.flag == 0)
    scenario.verify(generator.reserved_editions == 0)

    scenario.h2("Create generator with reserved editions")
    contract.create_generator(
        name=sp.bytes("0x526573657276656420456469746f6e732047656e"),
        description=sp.bytes("0x47656e657261746f722077697468207265736572766564"),
        code=sp.bytes("0x636f6e736f6c652e6c6f67282252657365727665642229"),
        author_bytes=sp.bytes("0x416c696365"),
        reserved_editions=10,
        _sender=alice
    )
    
    scenario.verify(contract.data.next_generator_id == 2)
    scenario.verify(contract.data.generators[1].reserved_editions == 10)

@sp.add_test()
def test_generator_updates():
    """
    Tests generator update functionality:
    - Author can update their own generators
    - Non-authors cannot update generators
    - Version increment on update
    - Reserved editions validation with existing sales
    """
    scenario = sp.test_scenario("Generator Updates", [svgkt, randomiser])

    admin = sp.test_account("Admin")
    alice = sp.test_account("Alice")
    bob = sp.test_account("Bob")

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

    # Create a generator
    contract.create_generator(
        name=sp.bytes("0x416c69636520417274"),
        description=sp.bytes("0x412062656175746966756c2067656e657261746f72"),
        code=sp.bytes("0x636f6e736f6c652e6c6f67282248656c6c6f20576f726c642229"),
        author_bytes=sp.bytes("0x416c696365"),
        reserved_editions=0,
        _sender=alice
    )

    scenario.h2("Author can update their generator")
    contract.update_generator(
        generator_id=0,
        name=sp.bytes("0x416c69636520417274205632"),
        description=sp.bytes("0x557064617465642067656e657261746f72"),
        code=sp.bytes("0x636f6e736f6c652e6c6f67282248656c6c6f20576f726c64205632"),
        author_bytes=sp.bytes("0x416c696365"),
        reserved_editions=0,
        _sender=alice
    )
    
    generator = contract.data.generators[0]
    scenario.verify(generator.version == 2)
    scenario.verify(generator.name == sp.bytes("0x416c69636520417274205632"))

    scenario.h2("Non-author cannot update generator")
    contract.update_generator(
        generator_id=0,
        name=sp.bytes("0x426f622041727420"),
        description=sp.bytes("0x426f62732067656e657261746f72"),
        code=sp.bytes("0x636f6e736f6c652e6c6f67282248656c6c6f20426f62"),
        author_bytes=sp.bytes("0x426f62"),
        reserved_editions=0,
        _sender=bob,
        _valid=False,
        _exception="ONLY_AUTHOR"
    )

@sp.add_test()
def test_reserved_editions_validation():
    """
    Tests reserved editions validation in updates:
    - Reserved editions cannot exceed sale capacity
    - Reserved editions can be updated within limits
    """
    scenario = sp.test_scenario("Reserved Editions Validation", [svgkt, randomiser])

    admin = sp.test_account("Admin")
    alice = sp.test_account("Alice")

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

    # Create generator with reserved editions
    contract.create_generator(
        name=sp.bytes("0x526573657276652055706461746520546573742020"),
        description=sp.bytes("0x54657374696e6720726573657276656420656469746f6e7320696e20757064617465"),
        code=sp.bytes("0x636f6e736f6c652e6c6f67282254657374"),
        author_bytes=sp.bytes("0x416c696365"),
        reserved_editions=2,
        _sender=alice
    )

    # Set sale configuration
    contract.set_sale(
        generator_id=0,
        start_time=None,
        price=sp.mutez(100000),
        paused=False,
        editions=10,
        max_per_wallet=None,
        _sender=alice
    )

    scenario.h2("Can update reserved editions within capacity")
    contract.update_generator(
        generator_id=0,
        name=sp.bytes("0x526573657276652055706461746520546573742020"),
        description=sp.bytes("0x54657374696e6720726573657276656420656469746f6e7320696e20757064617465"),
        code=sp.bytes("0x636f6e736f6c652e6c6f67282254657374"),
        author_bytes=sp.bytes("0x416c696365"),
        reserved_editions=5,
        _sender=alice
    )

    scenario.h2("Cannot update reserved editions beyond capacity")
    contract.update_generator(
        generator_id=0,
        name=sp.bytes("0x526573657276652055706461746520546573742020"),
        description=sp.bytes("0x54657374696e6720726573657276656420656469746f6e7320696e20757064617465"),
        code=sp.bytes("0x636f6e736f6c652e6c6f67282254657374"),
        author_bytes=sp.bytes("0x416c696365"),
        reserved_editions=15,
        _sender=alice,
        _valid=False,
        _exception="RESERVE_EXCEEDS_CAPACITY"
    )

@sp.add_test()
def test_input_validation():
    """
    Tests input validation for generator creation and updates:
    - Name length limits
    - Description length limits  
    - Code length limits
    - Author bytes length limits
    - Empty bytes handling
    """
    scenario = sp.test_scenario("Input Validation", [svgkt, randomiser])

    admin = sp.test_account("Admin")
    alice = sp.test_account("Alice")

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

    scenario.h2("Name too long fails")
    long_name = sp.bytes("0x" + "41" * 501)
    contract.create_generator(
        name=long_name,
        description=sp.bytes("0x54657374"),
        code=sp.bytes("0x636f6e736f6c652e6c6f67282254657374"),
        author_bytes=sp.bytes("0x416c696365"),
        reserved_editions=0,
        _sender=alice,
        _valid=False,
        _exception="NAME_TOO_LONG"
    )

    scenario.h2("Description too long fails")
    long_desc = sp.bytes("0x" + "41" * 8001)
    contract.create_generator(
        name=sp.bytes("0x54657374"),
        description=long_desc,
        code=sp.bytes("0x636f6e736f6c652e6c6f67282254657374"),
        author_bytes=sp.bytes("0x416c696365"),
        reserved_editions=0,
        _sender=alice,
        _valid=False,
        _exception="DESC_TOO_LONG"
    )

    scenario.h2("Code too long fails")
    long_code = sp.bytes("0x" + "41" * 30001)
    contract.create_generator(
        name=sp.bytes("0x54657374"),
        description=sp.bytes("0x54657374"),
        code=long_code,
        author_bytes=sp.bytes("0x416c696365"),
        reserved_editions=0,
        _sender=alice,
        _valid=False,
        _exception="CODE_TOO_LONG"
    )

    scenario.h2("Author bytes too long fails")
    long_author = sp.bytes("0x" + "41" * 51)
    contract.create_generator(
        name=sp.bytes("0x54657374"),
        description=sp.bytes("0x54657374"),
        code=sp.bytes("0x636f6e736f6c652e6c6f67282254657374"),
        author_bytes=long_author,
        reserved_editions=0,
        _sender=alice,
        _valid=False,
        _exception="AUTHOR_TOO_LONG"
    )

    scenario.h2("Empty bytes are allowed")
    contract.create_generator(
        name=sp.bytes("0x"),
        description=sp.bytes("0x"),
        code=sp.bytes("0x"),
        author_bytes=sp.bytes("0x"),
        reserved_editions=0,
        _sender=alice
    )
    
    generator = contract.data.generators[0]
    scenario.verify(generator.name == sp.bytes("0x"))
    scenario.verify(generator.description == sp.bytes("0x"))
    scenario.verify(generator.code == sp.bytes("0x"))
    scenario.verify(generator.author_bytes == sp.bytes("0x"))

@sp.add_test()
def test_byte_limit_configuration():
    """
    Tests dynamic byte limit configuration:
    - Moderators can set byte limits
    - New limits are enforced on creation/update
    - Non-mods cannot set limits
    """
    scenario = sp.test_scenario("Byte Limit Configuration", [svgkt, randomiser])

    admin = sp.test_account("Admin")
    alice = sp.test_account("Alice")
    moderator = sp.test_account("Moderator")

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

    # Add moderator
    contract.add_moderator(moderator.address, _sender=admin)

    scenario.h2("Admin can set byte limits")
    contract.set_max_bytes_name(200, _sender=admin)
    scenario.verify(contract.data.max_bytes_name == 200)
    
    contract.set_max_bytes_desc(10000, _sender=admin)
    scenario.verify(contract.data.max_bytes_desc == 10000)
    
    contract.set_max_bytes_code(40000, _sender=admin)
    scenario.verify(contract.data.max_bytes_code == 40000)
    
    contract.set_max_bytes_author(50, _sender=admin)
    scenario.verify(contract.data.max_bytes_author == 50)

    scenario.h2("New limits are enforced")
    long_author = sp.bytes("0x" + "41" * 51)
    contract.create_generator(
        name=sp.bytes("0x54657374"),
        description=sp.bytes("0x54657374"),
        code=sp.bytes("0x636f6e736f6c652e6c6f67282254657374"),
        author_bytes=long_author,
        reserved_editions=0,
        _sender=alice,
        _valid=False,
        _exception="AUTHOR_TOO_LONG"
    )

@sp.add_test()
def test_generator_flagging():
    """
    Tests generator flagging functionality:
    - Moderators can flag generators
    - Admin can flag generators
    - Non-mods cannot flag generators
    - Flag values are stored correctly
    """
    scenario = sp.test_scenario("Generator Flagging", [svgkt, randomiser])

    admin = sp.test_account("Admin")
    alice = sp.test_account("Alice")
    bob = sp.test_account("Bob")
    moderator = sp.test_account("Moderator")

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

    # Add moderator
    contract.add_moderator(moderator.address, _sender=admin)

    # Create a generator
    contract.create_generator(
        name=sp.bytes("0x546573742047656e657261746f72"),
        description=sp.bytes("0x54657374"),
        code=sp.bytes("0x636f6e736f6c652e6c6f67282254657374"),
        author_bytes=sp.bytes("0x416c696365"),
        reserved_editions=0,
        _sender=alice
    )

    scenario.h2("Moderator can flag generator")
    contract.flag_generator(generator_id=0, flag=1, _sender=moderator)
    scenario.verify(contract.data.generators[0].flag == 1)

    scenario.h2("Admin can flag generator")
    contract.flag_generator(generator_id=0, flag=2, _sender=admin)
    scenario.verify(contract.data.generators[0].flag == 2)

    scenario.h2("Non-mod cannot flag generator")
    contract.flag_generator(
        generator_id=0,
        flag=3,
        _sender=bob,
        _valid=False,
        _exception="ONLY_MODS"
    )

@sp.add_test()
def test_large_numbers_edge_case():
    """
    Tests handling of large numbers in generator creation:
    - Large reserved editions
    - Maximum values within reasonable limits
    """
    scenario = sp.test_scenario("Large Numbers Edge Case", [svgkt, randomiser])

    admin = sp.test_account("Admin")
    alice = sp.test_account("Alice")

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

    scenario.h2("Can create generator with large reserved editions")
    contract.create_generator(
        name=sp.bytes("0x4c61726765204e756d6265722054657374"),
        description=sp.bytes("0x54657374696e67206c61726765206e756d62657273"),
        code=sp.bytes("0x636f6e736f6c652e6c6f67282254657374"),
        author_bytes=sp.bytes("0x416c696365"),
        reserved_editions=999999,
        _sender=alice
    )
    
    scenario.verify(contract.data.generators[0].reserved_editions == 999999)
