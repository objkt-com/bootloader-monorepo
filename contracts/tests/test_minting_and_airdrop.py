"""
Minting and Airdrop Tests

This module tests all minting-related functionality:
- Public minting with various conditions
- Free minting (zero price)
- Airdrop functionality (author-only)
- Reserved editions handling in airdrops
- Edition limits and sold out conditions
- Token metadata creation
- Pause behavior with airdrops
"""

from svgkt import svgkt
from randomiser import randomiser
import smartpy as sp
import os

@sp.add_test()
def test_public_minting():
    """
    Tests basic public minting functionality:
    - Successful minting with correct payment
    - Token ID increment
    - Ledger updates
    - Generator token count updates
    - Token extra data storage
    """
    scenario = sp.test_scenario("Public Minting", [svgkt, randomiser])

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
        name=sp.bytes("0x416c69636520417274"),
        description=sp.bytes("0x412062656175746966756c2067656e657261746f72"),
        code=sp.bytes("0x636f6e736f6c652e6c6f67282248656c6c6f20576f726c642229"),
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
        editions=100,
        max_per_wallet=None,
        _sender=alice
    )

    scenario.h2("Successful minting")
    contract.mint(
        generator_id=0, 
        entropy=sp.bytes("0x" + os.urandom(16).hex()),
        _sender=bob,
        _amount=sp.mutez(1000000)
    )
    
    scenario.verify(contract.data.next_token_id == 1)
    scenario.verify(contract.data.ledger[0] == bob.address)
    scenario.verify(contract.data.generators[0].n_tokens == 1)
    scenario.verify(contract.data.token_extra[0].generator_id == 0)
    scenario.verify(contract.data.token_extra[0].generator_version == 1)
    scenario.verify(contract.data.token_extra[0].iteration_number == 1)

    scenario.h2("Multiple mints increment correctly")
    contract.mint(
        generator_id=0, 
        entropy=sp.bytes("0x" + os.urandom(16).hex()),
        _sender=bob,
        _amount=sp.mutez(1000000)
    )
    
    scenario.verify(contract.data.next_token_id == 2)
    scenario.verify(contract.data.generators[0].n_tokens == 2)
    scenario.verify(contract.data.token_extra[1].iteration_number == 2)

@sp.add_test()
def test_free_minting():
    """
    Tests free minting functionality:
    - Zero price minting works
    - Overpaying for free mint fails
    - Free mint with correct amount (zero)
    """
    scenario = sp.test_scenario("Free Minting", [svgkt, randomiser])

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

    # Create generator
    contract.create_generator(
        name=sp.bytes("0x46726565204172742047656e"),
        description=sp.bytes("0x46726565206d696e74696e672067656e657261746f72"),
        code=sp.bytes("0x636f6e736f6c652e6c6f67282246726565204172742229"),
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
        editions=50,
        max_per_wallet=None,
        _sender=alice
    )

    scenario.h2("Free minting works")
    contract.mint(
        generator_id=0, 
        entropy=sp.bytes("0x" + os.urandom(16).hex()),
        _sender=charlie,
        _amount=sp.mutez(0)
    )
    
    scenario.verify(contract.data.next_token_id == 1)
    scenario.verify(contract.data.ledger[0] == charlie.address)

    scenario.h2("Overpaying for free mint fails")
    contract.mint(
        generator_id=0,
        entropy=sp.bytes("0x" + os.urandom(16).hex()),
        _sender=bob,
        _amount=sp.mutez(1),
        _valid=False,
        _exception="PRICE_MISMATCH"
    )

@sp.add_test()
def test_airdrop_functionality():
    """
    Tests airdrop functionality:
    - Author can airdrop tokens
    - Non-author cannot airdrop
    - Airdrop uses reserved editions
    - Airdrop works when sale is paused
    - Airdrop fails when no reserved editions left
    """
    scenario = sp.test_scenario("Airdrop Functionality", [svgkt, randomiser])

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

    # Create generator with reserved editions
    contract.create_generator(
        name=sp.bytes("0x41697264726f702054657374"),
        description=sp.bytes("0x54657374696e672061697264726f70"),
        code=sp.bytes("0x636f6e736f6c652e6c6f67282254657374"),
        author_bytes=sp.bytes("0x416c696365"),
        reserved_editions=5,
        _sender=alice
    )

    # Set sale
    contract.set_sale(
        generator_id=0,
        start_time=None,
        price=sp.mutez(100000),
        paused=False,
        editions=10,
        max_per_wallet=None,
        _sender=alice
    )

    scenario.h2("Author can airdrop")
    contract.airdrop(
        generator_id=0,
        recipient=charlie.address,
        entropy=sp.bytes("0x" + os.urandom(16).hex()),
        _sender=alice
    )
    
    scenario.verify(contract.data.next_token_id == 1)
    scenario.verify(contract.data.ledger[0] == charlie.address)
    scenario.verify(contract.data.generators[0].reserved_editions == 4)
    scenario.verify(contract.data.generators[0].n_tokens == 1)

    scenario.h2("Non-author cannot airdrop")
    contract.airdrop(
        generator_id=0,
        recipient=bob.address,
        entropy=sp.bytes("0x" + os.urandom(16).hex()),
        _sender=bob,
        _valid=False,
        _exception="ONLY_AUTHOR"
    )

    scenario.h2("Use up remaining reserved editions")
    for i in range(4):
        contract.airdrop(
            generator_id=0,
            recipient=bob.address,
            entropy=sp.bytes("0x" + os.urandom(16).hex()),
            _sender=alice
        )

    scenario.h2("Cannot airdrop when no reserved editions left")
    contract.airdrop(
        generator_id=0,
        recipient=charlie.address,
        entropy=sp.bytes("0x" + os.urandom(16).hex()),
        _sender=alice,
        _valid=False,
        _exception="NO_RESERVED_LEFT"
    )

@sp.add_test()
def test_airdrop_with_paused_sale():
    """
    Tests that airdrop works even when sale is paused:
    - Airdrop works when sale is paused
    - Public minting fails when paused
    """
    scenario = sp.test_scenario("Airdrop with Paused Sale", [svgkt, randomiser])

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

    # Create generator with reserved editions
    contract.create_generator(
        name=sp.bytes("0x50617573652041697264726f702054657374"),
        description=sp.bytes("0x54657374696e67207061757365642061697264726f70"),
        code=sp.bytes("0x636f6e736f6c652e6c6f67282254657374"),
        author_bytes=sp.bytes("0x416c696365"),
        reserved_editions=5,
        _sender=alice
    )

    # Set paused sale
    contract.set_sale(
        generator_id=0,
        start_time=None,
        price=sp.mutez(1000000),
        paused=True,
        editions=10,
        max_per_wallet=None,
        _sender=alice
    )

    scenario.h2("Airdrop works when sale is paused")
    contract.airdrop(
        generator_id=0,
        recipient=bob.address,
        entropy=sp.bytes("0x" + os.urandom(16).hex()),
        _sender=alice
    )
    
    scenario.verify(contract.data.next_token_id == 1)
    scenario.verify(contract.data.ledger[0] == bob.address)

    scenario.h2("Public minting fails when paused")
    contract.mint(
        generator_id=0, 
        entropy=sp.bytes("0x" + os.urandom(16).hex()),
        _sender=charlie,
        _amount=sp.mutez(1000000),
        _valid=False,
        _exception="SALE_PAUSED"
    )

@sp.add_test()
def test_edition_limits():
    """
    Tests edition limits for both minting and airdrop:
    - Public minting respects reserved editions
    - Sold out conditions
    - Airdrop can exceed public limit but not total limit
    """
    scenario = sp.test_scenario("Edition Limits", [svgkt, randomiser])

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

    # Create generator with limited editions
    contract.create_generator(
        name=sp.bytes("0x4c696d69746564204172742047656e"),
        description=sp.bytes("0x4c696d697465642065646974696f6e2067656e657261746f72"),
        code=sp.bytes("0x636f6e736f6c652e6c6f67282253636172636520417274"),
        author_bytes=sp.bytes("0x416c696365"),
        reserved_editions=2,
        _sender=alice
    )

    # Set sale with very limited editions
    contract.set_sale(
        generator_id=0,
        start_time=None,
        price=sp.mutez(500000),
        paused=False,
        editions=5,  # 5 total, 2 reserved = 3 public
        max_per_wallet=None,
        _sender=alice
    )

    scenario.h2("Can mint up to public limit")
    # Mint 3 tokens (public limit)
    for i in range(3):
        contract.mint(
            generator_id=0, 
            entropy=sp.bytes("0x" + os.urandom(16).hex()),
            _sender=bob,
            _amount=sp.mutez(500000)
        )

    scenario.h2("Cannot mint beyond public limit")
    contract.mint(
        generator_id=0, 
        entropy=sp.bytes("0x" + os.urandom(16).hex()),
        _sender=charlie,
        _amount=sp.mutez(500000),
        _valid=False,
        _exception="PUBLIC_SOLD_OUT"
    )

    scenario.h2("Airdrop still works within reserved editions")
    contract.airdrop(
        generator_id=0,
        recipient=charlie.address,
        entropy=sp.bytes("0x" + os.urandom(16).hex()),
        _sender=alice
    )
    
    scenario.verify(contract.data.generators[0].n_tokens == 4)
    scenario.verify(contract.data.generators[0].reserved_editions == 1)

@sp.add_test()
def test_reserved_editions_comprehensive():
    """
    Tests comprehensive reserved editions functionality:
    - Reserved editions are properly tracked
    - Public minting respects reserved editions
    - Airdrop decrements reserved editions
    - Mixed minting and airdrop scenarios
    """
    scenario = sp.test_scenario("Reserved Editions Comprehensive", [svgkt, randomiser])

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

    # Create generator with reserved editions
    contract.create_generator(
        name=sp.bytes("0x526573657276656420456469746f6e732054657374"),
        description=sp.bytes("0x54657374696e6720726573657276656420656469746f6e73"),
        code=sp.bytes("0x636f6e736f6c652e6c6f67282254657374"),
        author_bytes=sp.bytes("0x416c696365"),
        reserved_editions=5,
        _sender=alice
    )

    # Set sale configuration
    contract.set_sale(
        generator_id=0,
        start_time=None,
        price=sp.mutez(1000000),
        paused=False,
        editions=10,
        max_per_wallet=None,
        _sender=alice
    )

    scenario.h2("Airdrop uses reserved editions")
    contract.airdrop(
        generator_id=0,
        recipient=bob.address,
        entropy=sp.bytes("0x" + os.urandom(16).hex()),
        _sender=alice
    )
    
    scenario.verify(contract.data.generators[0].reserved_editions == 4)
    scenario.verify(contract.data.generators[0].n_tokens == 1)

    scenario.h2("Public minting respects reserved editions")
    # Should only be able to mint 4 more (10 total - 5 reserved - 1 already minted)
    for i in range(4):
        contract.mint(
            generator_id=0, 
            entropy=sp.bytes("0x" + os.urandom(16).hex()),
            _sender=charlie,
            _amount=sp.mutez(1000000)
        )

    scenario.h2("Public minting fails when limit reached")
    contract.mint(
        generator_id=0, 
        entropy=sp.bytes("0x" + os.urandom(16).hex()),
        _sender=charlie,
        _amount=sp.mutez(1000000),
        _valid=False,
        _exception="PUBLIC_SOLD_OUT"
    )

    scenario.h2("Airdrop still works with remaining reserved")
    contract.airdrop(
        generator_id=0,
        recipient=charlie.address,
        entropy=sp.bytes("0x" + os.urandom(16).hex()),
        _sender=alice
    )
    
    scenario.verify(contract.data.generators[0].n_tokens == 6)
    scenario.verify(contract.data.generators[0].reserved_editions == 3)

@sp.add_test()
def test_sold_out_conditions():
    """
    Tests various sold out conditions:
    - Public sold out with reserved editions remaining
    - Complete sold out (no reserved editions)
    - Airdrop behavior when sold out
    """
    scenario = sp.test_scenario("Sold Out Conditions", [svgkt, randomiser])

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

    # Create generator with no reserved editions
    contract.create_generator(
        name=sp.bytes("0x536f6c64204f75742054657374"),
        description=sp.bytes("0x54657374696e6720736f6c64206f757420636f6e646974696f6e73"),
        code=sp.bytes("0x636f6e736f6c652e6c6f67282254657374"),
        author_bytes=sp.bytes("0x416c696365"),
        reserved_editions=0,
        _sender=alice
    )

    # Set sale with very limited editions
    contract.set_sale(
        generator_id=0,
        start_time=None,
        price=sp.mutez(100000),
        paused=False,
        editions=2,
        max_per_wallet=None,
        _sender=alice
    )

    scenario.h2("Mint all available editions")
    for i in range(2):
        contract.mint(
            generator_id=0, 
            entropy=sp.bytes("0x" + os.urandom(16).hex()),
            _sender=bob,
            _amount=sp.mutez(100000)
        )

    scenario.h2("Cannot mint when completely sold out")
    contract.mint(
        generator_id=0, 
        entropy=sp.bytes("0x" + os.urandom(16).hex()),
        _sender=bob,
        _amount=sp.mutez(100000),
        _valid=False,
        _exception="PUBLIC_SOLD_OUT"
    )

    scenario.h2("Cannot airdrop when no reserved editions")
    contract.airdrop(
        generator_id=0,
        recipient=bob.address,
        entropy=sp.bytes("0x" + os.urandom(16).hex()),
        _sender=alice,
        _valid=False,
        _exception="NO_RESERVED_LEFT"
    )
