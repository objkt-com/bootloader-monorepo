"""
FA2 Operations and Token Management Tests

This module tests all FA2-related functionality:
- Token transfers
- Token burning
- Token regeneration (version updates)
- Thumbnail updates
- Token metadata handling
- Owner-only operations
"""

from svgkt import svgkt
from randomiser import randomiser
import smartpy as sp
import os

@sp.add_test()
def test_token_transfers():
    """
    Tests FA2 token transfer functionality:
    - Successful token transfers
    - Transfer ownership changes
    - Transfer validation
    """
    scenario = sp.test_scenario("Token Transfers", [svgkt, randomiser])

    admin = sp.test_account("Admin")
    alice = sp.test_account("Alice")
    bob = sp.test_account("Bob")
    charlie = sp.test_account("Charlie")

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

    # Add fragments for minting
    for i in range(4):
        contract.add_fragment(
            frag_id=i, 
            frag=sp.bytes("0x3c73766720786d6c6e733d22687474703a2f2f7777772e77332e6f72672f323030302f737667222076696577426f783d22302030203130302031303022207374796c653d226261636b67726f756e642d636f6c6f723a77686974653b223e"),
            _sender=admin
        )

    # Create generator and mint token
    contract.create_generator(
        name=sp.bytes("0x5472616e73666572205465737420417274"),
        description=sp.bytes("0x54657374696e67207472616e7366657273"),
        code=sp.bytes("0x636f6e736f6c652e6c6f67282254657374"),
        author_bytes=sp.bytes("0x416c696365"),
        reserved_editions=0,
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

    contract.mint(
        generator_id=0, 
        entropy=sp.bytes("0x" + os.urandom(16).hex()),
        _sender=bob,
        _amount=sp.mutez(0)
    )

    scenario.h2("Token is initially owned by minter")
    scenario.verify(contract.data.ledger[0] == bob.address)

    scenario.h2("Owner can transfer token")
    contract.transfer([
        sp.record(
            from_=bob.address,
            txs=[sp.record(to_=charlie.address, token_id=0, amount=1)]
        )
    ], _sender=bob)

    scenario.verify(contract.data.ledger[0] == charlie.address)

@sp.add_test()
def test_token_burning():
    """
    Tests FA2 token burning functionality:
    - Owner can burn their tokens
    - Non-owner cannot burn tokens
    - Token removal from ledger
    """
    scenario = sp.test_scenario("Token Burning", [svgkt, randomiser])

    admin = sp.test_account("Admin")
    alice = sp.test_account("Alice")
    bob = sp.test_account("Bob")
    charlie = sp.test_account("Charlie")

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

    # Add fragments for minting
    for i in range(4):
        contract.add_fragment(
            frag_id=i, 
            frag=sp.bytes("0x3c73766720786d6c6e733d22687474703a2f2f7777772e77332e6f72672f323030302f737667222076696577426f783d22302030203130302031303022207374796c653d226261636b67726f756e642d636f6c6f723a77686974653b223e"),
            _sender=admin
        )

    # Create generator and mint tokens
    contract.create_generator(
        name=sp.bytes("0x4275726e205465737420417274"),
        description=sp.bytes("0x54657374696e67206275726e696e67"),
        code=sp.bytes("0x636f6e736f6c652e6c6f67282254657374"),
        author_bytes=sp.bytes("0x416c696365"),
        reserved_editions=0,
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

    # Mint two tokens
    contract.mint(
        generator_id=0, 
        entropy=sp.bytes("0x" + os.urandom(16).hex()),
        _sender=bob,
        _amount=sp.mutez(0)
    )

    contract.mint(
        generator_id=0, 
        entropy=sp.bytes("0x" + os.urandom(16).hex()),
        _sender=charlie,
        _amount=sp.mutez(0)
    )

    scenario.h2("Tokens exist in ledger")
    scenario.verify(contract.data.ledger[0] == bob.address)
    scenario.verify(contract.data.ledger[1] == charlie.address)

    scenario.h2("Non-owner cannot burn token")
    contract.burn([sp.record(from_=bob.address, token_id=0, amount=1)], 
                  _sender=charlie, _valid=False)

    scenario.h2("Owner can burn their token")
    contract.burn([sp.record(from_=bob.address, token_id=0, amount=1)], 
                  _sender=bob)

    scenario.verify(~contract.data.ledger.contains(0))
    scenario.verify(contract.data.ledger[1] == charlie.address)

@sp.add_test()
def test_token_regeneration():
    """
    Tests token regeneration functionality:
    - Owner can regenerate token after generator update
    - Non-owner cannot regenerate token
    - Generator version tracking
    - No regeneration when no update available
    """
    scenario = sp.test_scenario("Token Regeneration", [svgkt, randomiser])

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

    # Add fragments for minting
    for i in range(4):
        contract.add_fragment(
            frag_id=i, 
            frag=sp.bytes("0x3c73766720786d6c6e733d22687474703a2f2f7777772e77332e6f72672f323030302f737667222076696577426f783d22302030203130302031303022207374796c653d226261636b67726f756e642d636f6c6f723a77686974653b223e"),
            _sender=admin
        )

    # Create generator and mint token
    contract.create_generator(
        name=sp.bytes("0x56657273696f6e696e672054657374"),
        description=sp.bytes("0x54657374696e672067656e657261746f722076657273696f6e696e67"),
        code=sp.bytes("0x636f6e736f6c652e6c6f67282256657273696f6e203122"),
        author_bytes=sp.bytes("0x416c696365"),
        reserved_editions=0,
        _sender=alice
    )

    contract.set_sale(
        generator_id=0,
        start_time=None,
        price=sp.mutez(100000),
        paused=False,
        editions=5,
        max_per_wallet=None,
        _sender=alice
    )

    contract.mint(
        generator_id=0, 
        entropy=sp.bytes("0x" + os.urandom(16).hex()),
        _sender=bob,
        _amount=sp.mutez(100000)
    )

    token_id = 0
    initial_version = contract.data.generators[0].version
    scenario.verify(initial_version == 1)
    scenario.verify(contract.data.token_extra[token_id].generator_version == 1)

    scenario.h2("Update generator increments version")
    contract.update_generator(
        generator_id=0,
        name=sp.bytes("0x56657273696f6e696e672054657374205632"),
        description=sp.bytes("0x557064617465642067656e657261746f72"),
        code=sp.bytes("0x636f6e736f6c652e6c6f67282256657273696f6e203222"),
        author_bytes=sp.bytes("0x416c696365"),
        reserved_editions=0,
        _sender=alice
    )

    scenario.verify(contract.data.generators[0].version == 2)

    scenario.h2("Owner can regenerate token")
    contract.regenerate_token(token_id, _sender=bob)
    scenario.verify(contract.data.token_extra[token_id].generator_version == 2)

    scenario.h2("Non-owner cannot regenerate token")
    contract.regenerate_token(
        token_id,
        _sender=alice,
        _valid=False,
        _exception="ONLY_OWNER"
    )

    scenario.h2("Cannot regenerate when no update available")
    contract.regenerate_token(
        token_id,
        _sender=bob,
        _valid=False,
        _exception="NO_UPDATE_POSSIBLE"
    )

@sp.add_test()
def test_thumbnail_updates():
    """
    Tests thumbnail update functionality:
    - Author can update thumbnails
    - Moderators can update thumbnails
    - Admin can update thumbnails
    - Non-privileged users cannot update thumbnails
    """
    scenario = sp.test_scenario("Thumbnail Updates", [svgkt, randomiser])

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

    # Add fragments for minting
    for i in range(4):
        contract.add_fragment(
            frag_id=i, 
            frag=sp.bytes("0x3c73766720786d6c6e733d22687474703a2f2f7777772e77332e6f72672f323030302f737667222076696577426f783d22302030203130302031303022207374796c653d226261636b67726f756e642d636f6c6f723a77686974653b223e"),
            _sender=admin
        )

    # Create generator and mint token
    contract.create_generator(
        name=sp.bytes("0x5468756d626e61696c2054657374"),
        description=sp.bytes("0x54657374696e67207468756d626e61696c20757064617465"),
        code=sp.bytes("0x636f6e736f6c652e6c6f67282254657374"),
        author_bytes=sp.bytes("0x416c696365"),
        reserved_editions=0,
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

    contract.mint(
        generator_id=0, 
        entropy=sp.bytes("0x" + os.urandom(16).hex()),
        _sender=bob,
        _amount=sp.mutez(0)
    )

    thumbnail_token_id = 0
    new_thumbnail = sp.bytes("0x68747470733a2f2f6e65772d7468756d626e61696c2e636f6d")

    scenario.h2("Author can update thumbnail")
    contract.update_thumbnail(
        token_id=thumbnail_token_id,
        thumbnailUri=new_thumbnail,
        _sender=alice
    )

    scenario.h2("Moderator can update thumbnail")
    contract.update_thumbnail(
        token_id=thumbnail_token_id,
        thumbnailUri=sp.bytes("0x68747470733a2f2f6d6f642d7468756d626e61696c2e636f6d"),
        _sender=moderator
    )

    scenario.h2("Admin can update thumbnail")
    contract.update_thumbnail(
        token_id=thumbnail_token_id,
        thumbnailUri=sp.bytes("0x68747470733a2f2f61646d696e2d7468756d626e61696c2e636f6d"),
        _sender=admin
    )

    scenario.h2("Non-privileged user cannot update thumbnail")
    contract.update_thumbnail(
        token_id=thumbnail_token_id,
        thumbnailUri=new_thumbnail,
        _sender=bob,
        _valid=False,
        _exception="ONLY_AUTHOR_OR_MODS"
    )

@sp.add_test()
def test_token_metadata_creation():
    """
    Tests token metadata creation during minting:
    - Metadata includes correct generator information
    - Iteration numbers are tracked correctly
    - Token metadata structure is correct
    """
    scenario = sp.test_scenario("Token Metadata Creation", [svgkt, randomiser])

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

    # Add fragments for minting
    for i in range(4):
        contract.add_fragment(
            frag_id=i, 
            frag=sp.bytes("0x3c73766720786d6c6e733d22687474703a2f2f7777772e77332e6f72672f323030302f737667222076696577426f783d22302030203130302031303022207374796c653d226261636b67726f756e642d636f6c6f723a77686974653b223e"),
            _sender=admin
        )

    # Create generator
    contract.create_generator(
        name=sp.bytes("0x4d6574616461746120546573742047656e"),
        description=sp.bytes("0x54657374696e67206d65746164617461"),
        code=sp.bytes("0x636f6e736f6c652e6c6f67282254657374"),
        author_bytes=sp.bytes("0x416c696365"),
        reserved_editions=0,
        _sender=alice
    )

    contract.set_sale(
        generator_id=0,
        start_time=None,
        price=sp.mutez(0),
        paused=False,
        editions=5,
        max_per_wallet=None,
        _sender=alice
    )

    scenario.h2("First token has iteration 1")
    contract.mint(
        generator_id=0, 
        entropy=sp.bytes("0x" + os.urandom(16).hex()),
        _sender=bob,
        _amount=sp.mutez(0)
    )

    scenario.verify(contract.data.token_extra[0].iteration_number == 1)
    scenario.verify(contract.data.token_extra[0].generator_id == 0)
    scenario.verify(contract.data.token_extra[0].generator_version == 1)

    scenario.h2("Second token has iteration 2")
    contract.mint(
        generator_id=0, 
        entropy=sp.bytes("0x" + os.urandom(16).hex()),
        _sender=bob,
        _amount=sp.mutez(0)
    )

    scenario.verify(contract.data.token_extra[1].iteration_number == 2)
    scenario.verify(contract.data.token_extra[1].generator_id == 0)
    scenario.verify(contract.data.token_extra[1].generator_version == 1)

@sp.add_test()
def test_multiple_token_operations():
    """
    Tests operations on multiple tokens:
    - Multiple transfers in single transaction
    - Multiple burns in single transaction
    - Mixed token operations
    """
    scenario = sp.test_scenario("Multiple Token Operations", [svgkt, randomiser])

    admin = sp.test_account("Admin")
    alice = sp.test_account("Alice")
    bob = sp.test_account("Bob")
    charlie = sp.test_account("Charlie")

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

    # Add fragments for minting
    for i in range(4):
        contract.add_fragment(
            frag_id=i, 
            frag=sp.bytes("0x3c73766720786d6c6e733d22687474703a2f2f7777772e77332e6f72672f323030302f737667222076696577426f783d22302030203130302031303022207374796c653d226261636b67726f756e642d636f6c6f723a77686974653b223e"),
            _sender=admin
        )

    # Create generator and mint multiple tokens
    contract.create_generator(
        name=sp.bytes("0x4d756c7469706c6520546f6b656e2054657374"),
        description=sp.bytes("0x54657374696e67206d756c7469706c6520746f6b656e73"),
        code=sp.bytes("0x636f6e736f6c652e6c6f67282254657374"),
        author_bytes=sp.bytes("0x416c696365"),
        reserved_editions=0,
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

    # Mint multiple tokens to bob
    for i in range(3):
        contract.mint(
            generator_id=0, 
            entropy=sp.bytes("0x" + os.urandom(16).hex()),
            _sender=bob,
            _amount=sp.mutez(0)
        )

    scenario.h2("Bob owns multiple tokens")
    scenario.verify(contract.data.ledger[0] == bob.address)
    scenario.verify(contract.data.ledger[1] == bob.address)
    scenario.verify(contract.data.ledger[2] == bob.address)

    scenario.h2("Multiple transfers in single transaction")
    contract.transfer([
        sp.record(
            from_=bob.address,
            txs=[
                sp.record(to_=charlie.address, token_id=0, amount=1),
                sp.record(to_=charlie.address, token_id=1, amount=1)
            ]
        )
    ], _sender=bob)

    scenario.verify(contract.data.ledger[0] == charlie.address)
    scenario.verify(contract.data.ledger[1] == charlie.address)
    scenario.verify(contract.data.ledger[2] == bob.address)

    scenario.h2("Multiple burns in single transaction")
    contract.burn([
        sp.record(from_=charlie.address, token_id=0, amount=1),
        sp.record(from_=charlie.address, token_id=1, amount=1)
    ], _sender=charlie)

    scenario.verify(~contract.data.ledger.contains(0))
    scenario.verify(~contract.data.ledger.contains(1))
    scenario.verify(contract.data.ledger[2] == bob.address)

@sp.add_test()
def test_token_ownership_validation():
    """
    Tests token ownership validation across operations:
    - Only owners can perform owner-only operations
    - Ownership changes are properly tracked
    - Operations fail with correct errors for non-owners
    """
    scenario = sp.test_scenario("Token Ownership Validation", [svgkt, randomiser])

    admin = sp.test_account("Admin")
    alice = sp.test_account("Alice")
    bob = sp.test_account("Bob")
    charlie = sp.test_account("Charlie")

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

    # Add fragments for minting
    for i in range(4):
        contract.add_fragment(
            frag_id=i, 
            frag=sp.bytes("0x3c73766720786d6c6e733d22687474703a2f2f7777772e77332e6f72672f323030302f737667222076696577426f783d22302030203130302031303022207374796c653d226261636b67726f756e642d636f6c6f723a77686974653b223e"),
            _sender=admin
        )

    # Create generator and mint token
    contract.create_generator(
        name=sp.bytes("0x4f776e65727368697020546573742047656e"),
        description=sp.bytes("0x54657374696e67206f776e657273686970"),
        code=sp.bytes("0x636f6e736f6c652e6c6f67282254657374"),
        author_bytes=sp.bytes("0x416c696365"),
        reserved_editions=0,
        _sender=alice
    )

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

    # Update generator to enable regeneration testing
    contract.update_generator(
        generator_id=0,
        name=sp.bytes("0x4f776e65727368697020546573742047656e205632"),
        description=sp.bytes("0x557064617465642067656e657261746f72"),
        code=sp.bytes("0x636f6e736f6c652e6c6f67282256322054657374"),
        author_bytes=sp.bytes("0x416c696365"),
        reserved_editions=0,
        _sender=alice
    )

    token_id = 0

    scenario.h2("Owner can regenerate token")
    contract.regenerate_token(token_id, _sender=bob)

    scenario.h2("Non-owner cannot regenerate token")
    # Update generator again to enable another regeneration
    contract.update_generator(
        generator_id=0,
        name=sp.bytes("0x4f776e65727368697020546573742047656e205633"),
        description=sp.bytes("0x557064617465642067656e657261746f72"),
        code=sp.bytes("0x636f6e736f6c652e6c6f67282256332054657374"),
        author_bytes=sp.bytes("0x416c696365"),
        reserved_editions=0,
        _sender=alice
    )

    contract.regenerate_token(
        token_id,
        _sender=charlie,
        _valid=False,
        _exception="ONLY_OWNER"
    )

    scenario.h2("Transfer changes ownership")
    contract.transfer([
        sp.record(
            from_=bob.address,
            txs=[sp.record(to_=charlie.address, token_id=token_id, amount=1)]
        )
    ], _sender=bob)

    scenario.h2("New owner can regenerate token")
    contract.regenerate_token(token_id, _sender=charlie)

    scenario.h2("Old owner can no longer regenerate token")
    # Update generator again
    contract.update_generator(
        generator_id=0,
        name=sp.bytes("0x4f776e65727368697020546573742047656e205634"),
        description=sp.bytes("0x557064617465642067656e657261746f72"),
        code=sp.bytes("0x636f6e736f6c652e6c6f67282256342054657374"),
        author_bytes=sp.bytes("0x416c696365"),
        reserved_editions=0,
        _sender=alice
    )

    contract.regenerate_token(
        token_id,
        _sender=bob,
        _valid=False,
        _exception="ONLY_OWNER"
    )
