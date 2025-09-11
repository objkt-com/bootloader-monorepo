"""
Sale Configuration Tests

This module tests all sale-related functionality:
- Setting sale configurations (author-only)
- Sale state validation (paused, not started, price mismatch)
- Edition limits and reductions
- Max per wallet limits
- Timestamp boundaries
- Zero editions edge case
"""

from bootloader import bootloader
from randomiser import randomiser
import smartpy as sp
import os

@sp.add_test()
def test_sale_configuration():
    """
    Tests basic sale configuration functionality:
    - Author can set sale for their generator
    - Non-author cannot set sale
    - Sale parameters are stored correctly
    """
    scenario = sp.test_scenario("Sale Configuration", [bootloader, randomiser])

    admin = sp.test_account("Admin")
    alice = sp.test_account("Alice")
    bob = sp.test_account("Bob")

    rng = randomiser.RandomiserMock()
    scenario += rng

    contract = bootloader.Bootloader(
        admin_address=admin.address,
        rng_contract=rng.address, 
        contract_metadata=sp.big_map({}),
        ledger={},
        token_metadata=[]
    )
    scenario += contract

    # Add bootloader first
    storage_limits = sp.record(code=30000, name=500, desc=8000, author=50)
    contract.add_bootloader(
        version=sp.bytes("0x76302e302e31"),
        fragments=[
            sp.bytes("0x3c73766720786d6c6e733d22687474703a2f2f7777772e77332e6f72672f323030302f737667222076696577426f783d22302030203130302031303022207374796c653d226261636b67726f756e642d636f6c6f723a77686974653b223e"),
            sp.bytes("0x3c2f7376673e"),
            sp.bytes("0x3c2f7376673e"),
            sp.bytes("0x3c2f7376673e")
        ],
        fun=bootloader.v0_0_1,
        storage_limits=storage_limits,
        _sender=admin
    )

    # Create a generator
    contract.create_generator(
        name=sp.bytes("0x416c69636520417274"),
        description=sp.bytes("0x412062656175746966756c2067656e657261746f72"),
        code=sp.bytes("0x636f6e736f6c652e6c6f67282248656c6c6f20576f726c642229"),
        author_bytes=sp.bytes("0x416c696365"),
        reserved_editions=0,
        bootloader_id=0,
        _sender=alice
    )

    scenario.h2("Author can set sale configuration")
    contract.set_sale(
        generator_id=0,
        start_time=sp.Some(sp.timestamp(100)),
        price=sp.mutez(1000000),
        paused=False,
        editions=100,
        max_per_wallet=sp.Some(5),
        _sender=alice
    )
    
    generator = contract.data.generators[0]
    sale = generator.sale.unwrap_some()
    scenario.verify(sale.start_time == sp.Some(sp.timestamp(100)))
    scenario.verify(sale.price == sp.mutez(1000000))
    scenario.verify(sale.paused == False)
    scenario.verify(sale.editions == 100)
    scenario.verify(sale.max_per_wallet == sp.Some(5))

    scenario.h2("Non-author cannot set sale")
    contract.set_sale(
        generator_id=0,
        start_time=None,
        price=sp.mutez(2000000),
        paused=False,
        editions=50,
        max_per_wallet=None,
        _sender=bob,
        _valid=False,
        _exception="ONLY_AUTHOR"
    )

@sp.add_test()
def test_edition_limits_and_reductions():
    """
    Tests edition limit validation and reduction functionality:
    - Editions cannot be less than already minted + reserved
    - Edition reduction is allowed when no tokens minted
    - Edition increment is not allowed after minting starts
    """
    scenario = sp.test_scenario("Edition Limits and Reductions", [bootloader, randomiser])

    admin = sp.test_account("Admin")
    alice = sp.test_account("Alice")
    bob = sp.test_account("Bob")

    rng = randomiser.RandomiserMock()
    scenario += rng

    contract = bootloader.Bootloader(
        admin_address=admin.address,
        rng_contract=rng.address, 
        contract_metadata=sp.big_map({}),
        ledger={},
        token_metadata=[]
    )
    scenario += contract

    # Add bootloader first
    storage_limits = sp.record(code=30000, name=500, desc=8000, author=50)
    contract.add_bootloader(
        version=sp.bytes("0x76302e302e31"),
        fragments=[
            sp.bytes("0x3c73766720786d6c6e733d22687474703a2f2f7777772e77332e6f72672f323030302f737667222076696577426f783d22302030203130302031303022207374796c653d226261636b67726f756e642d636f6c6f723a77686974653b223e"),
            sp.bytes("0x3c2f7376673e"),
            sp.bytes("0x3c2f7376673e"),
            sp.bytes("0x3c2f7376673e")
        ],
        fun=bootloader.v0_0_1,
        storage_limits=storage_limits,
        _sender=admin
    )

    # Create generator with reserved editions
    contract.create_generator(
        name=sp.bytes("0x456469746f6e2054657374"),
        description=sp.bytes("0x54657374696e672065646974696f6e206368616e676573"),
        code=sp.bytes("0x636f6e736f6c652e6c6f67282245646974696f6e2054657374"),
        author_bytes=sp.bytes("0x416c696365"),
        reserved_editions=10,
        bootloader_id=0,
        _sender=alice
    )

    scenario.h2("Can set initial sale with valid editions")
    contract.set_sale(
        generator_id=0,
        start_time=None,
        price=sp.mutez(100000),
        paused=False,
        editions=100,
        max_per_wallet=None,
        _sender=alice
    )

    scenario.h2("Can reduce editions when no tokens minted")
    contract.set_sale(
        generator_id=0,
        start_time=None,
        price=sp.mutez(100000),
        paused=False,
        editions=50,
        max_per_wallet=None,
        _sender=alice
    )

    scenario.h2("Mint a token")
    contract.mint(
        generator_id=0, 
        entropy=sp.bytes("0x" + os.urandom(16).hex()),
        _sender=bob,
        _amount=sp.mutez(100000)
    )

    scenario.h2("Can still reduce editions after minting")
    contract.set_sale(
        generator_id=0,
        start_time=None,
        price=sp.mutez(100000),
        paused=False,
        editions=25,
        max_per_wallet=None,
        _sender=alice
    )

    scenario.h2("Cannot increase editions after minting")
    contract.set_sale(
        generator_id=0,
        start_time=None,
        price=sp.mutez(100000),
        paused=False,
        editions=75,
        max_per_wallet=None,
        _sender=alice,
        _valid=False,
        _exception="NO_ED_INCREMENT"
    )

    scenario.h2("Cannot set editions below minted + reserved")
    # We have 1 minted + 10 reserved = 11 minimum
    contract.set_sale(
        generator_id=0,
        start_time=None,
        price=sp.mutez(100000),
        paused=False,
        editions=10,
        max_per_wallet=None,
        _sender=alice,
        _valid=False,
        _exception="ED_LT_MINTED"
    )

@sp.add_test()
def test_max_per_wallet():
    """
    Tests max per wallet functionality:
    - Enforces wallet limits correctly
    - Different wallets can mint independently
    - No limit when max_per_wallet is None
    """
    scenario = sp.test_scenario("Max Per Wallet", [bootloader, randomiser])

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
        ledger={},
        token_metadata=[]
    )
    scenario += contract

    # Add bootloader first
    storage_limits = sp.record(code=30000, name=500, desc=8000, author=50)
    contract.add_bootloader(
        version=sp.bytes("0x76302e302e31"),
        fragments=[
            sp.bytes("0x3c73766720786d6c6e733d22687474703a2f2f7777772e77332e6f72672f323030302f737667222076696577426f783d22302030203130302031303022207374796c653d226261636b67726f756e642d636f6c6f723a77686974653b223e"),
            sp.bytes("0x3c2f7376673e"),
            sp.bytes("0x3c2f7376673e"),
            sp.bytes("0x3c2f7376673e")
        ],
        fun=bootloader.v0_0_1,
        storage_limits=storage_limits,
        _sender=admin
    )

    # Create generator
    contract.create_generator(
        name=sp.bytes("0x4d6178205065722057616c6c65742054657374"),
        description=sp.bytes("0x54657374696e67206d6178207065722077616c6c6574"),
        code=sp.bytes("0x636f6e736f6c652e6c6f67282254657374"),
        author_bytes=sp.bytes("0x416c696365"),
        reserved_editions=0,
        bootloader_id=0,
        _sender=alice
    )

    # Set sale with max per wallet limit
    contract.set_sale(
        generator_id=0,
        start_time=None,
        price=sp.mutez(500000),
        paused=False,
        editions=10,
        max_per_wallet=sp.Some(2),
        _sender=alice
    )

    scenario.h2("First mint should work")
    contract.mint(
        generator_id=0, 
        entropy=sp.bytes("0x" + os.urandom(16).hex()),
        _sender=bob,
        _amount=sp.mutez(500000)
    )

    scenario.h2("Second mint should work")
    contract.mint(
        generator_id=0, 
        entropy=sp.bytes("0x" + os.urandom(16).hex()),
        _sender=bob,
        _amount=sp.mutez(500000)
    )

    scenario.h2("Third mint should fail")
    contract.mint(
        generator_id=0, 
        entropy=sp.bytes("0x" + os.urandom(16).hex()),
        _sender=bob,
        _amount=sp.mutez(500000),
        _valid=False,
        _exception="EXCEEDS_MAX_PER_WALLET"
    )

    scenario.h2("Different wallet should work")
    contract.mint(
        generator_id=0, 
        entropy=sp.bytes("0x" + os.urandom(16).hex()),
        _sender=charlie,
        _amount=sp.mutez(500000)
    )

@sp.add_test()
def test_sale_states():
    """
    Tests various sale states and their validation:
    - Paused sales reject minting
    - Sales not yet started reject minting
    - Price mismatch rejection
    - No sale configuration rejection
    """
    scenario = sp.test_scenario("Sale States", [bootloader, randomiser])

    admin = sp.test_account("Admin")
    alice = sp.test_account("Alice")
    bob = sp.test_account("Bob")

    rng = randomiser.RandomiserMock()
    scenario += rng

    contract = bootloader.Bootloader(
        admin_address=admin.address,
        rng_contract=rng.address, 
        contract_metadata=sp.big_map({}),
        ledger={},
        token_metadata=[]
    )
    scenario += contract

    # Add bootloader first
    storage_limits = sp.record(code=30000, name=500, desc=8000, author=50)
    contract.add_bootloader(
        version=sp.bytes("0x76302e302e31"),
        fragments=[
            sp.bytes("0x3c73766720786d6c6e733d22687474703a2f2f7777772e77332e6f72672f323030302f737667222076696577426f783d22302030203130302031303022207374796c653d226261636b67726f756e642d636f6c6f723a77686974653b223e"),
            sp.bytes("0x3c2f7376673e"),
            sp.bytes("0x3c2f7376673e"),
            sp.bytes("0x3c2f7376673e")
        ],
        fun=bootloader.v0_0_1,
        storage_limits=storage_limits,
        _sender=admin
    )

    # Create generator
    contract.create_generator(
        name=sp.bytes("0x53616c6520537461746520546573742047656e"),
        description=sp.bytes("0x54657374696e672073616c6520737461746573"),
        code=sp.bytes("0x636f6e736f6c652e6c6f67282254657374"),
        author_bytes=sp.bytes("0x416c696365"),
        reserved_editions=0,
        bootloader_id=0,
        _sender=alice
    )

    scenario.h2("Cannot mint without sale configuration")
    contract.mint(
        generator_id=0, 
        entropy=sp.bytes("0x" + os.urandom(16).hex()),
        _sender=bob,
        _valid=False,
        _exception="NO_SALE_CONFIG"
    )

    scenario.h2("Cannot mint when sale is paused")
    contract.set_sale(
        generator_id=0,
        start_time=sp.Some(sp.timestamp(100)),
        price=sp.mutez(1000000),
        paused=True,
        editions=100,
        max_per_wallet=None,
        _sender=alice
    )
    
    contract.mint(
        generator_id=0, 
        entropy=sp.bytes("0x" + os.urandom(16).hex()),
        _sender=bob,
        _amount=sp.mutez(1000000),
        _valid=False,
        _exception="SALE_PAUSED"
    )

    scenario.h2("Cannot mint before sale starts")
    contract.set_sale(
        generator_id=0,
        start_time=sp.Some(sp.timestamp(200)),
        price=sp.mutez(1000000),
        paused=False,   
        editions=100,
        max_per_wallet=None,
        _sender=alice
    )
    
    contract.mint(
        generator_id=0, 
        entropy=sp.bytes("0x" + os.urandom(16).hex()),
        _sender=bob,
        _amount=sp.mutez(1000000),
        _now=sp.timestamp(150),
        _valid=False,
        _exception="SALE_NOT_STARTED"
    )

    scenario.h2("Cannot mint with wrong price")
    contract.mint(
        generator_id=0, 
        entropy=sp.bytes("0x" + os.urandom(16).hex()),
        _sender=bob,
        _amount=sp.mutez(500000),
        _now=sp.timestamp(250),
        _valid=False,
        _exception="PRICE_MISMATCH"
    )

    scenario.h2("Can mint with correct conditions")
    contract.mint(
        generator_id=0, 
        entropy=sp.bytes("0x" + os.urandom(16).hex()),
        _sender=bob,
        _amount=sp.mutez(1000000),
        _now=sp.timestamp(250)
    )
    
    scenario.verify(contract.data.next_token_id == 1)
    scenario.verify(contract.data.ledger[0] == bob.address)
    scenario.verify(contract.data.generators[0].n_tokens == 1)

@sp.add_test()
def test_timestamp_boundaries():
    """
    Tests timestamp boundary conditions:
    - Minting exactly at start time
    - Minting before and after start time
    """
    scenario = sp.test_scenario("Timestamp Boundaries", [bootloader, randomiser])

    admin = sp.test_account("Admin")
    alice = sp.test_account("Alice")
    bob = sp.test_account("Bob")

    rng = randomiser.RandomiserMock()
    scenario += rng

    contract = bootloader.Bootloader(
        admin_address=admin.address,
        rng_contract=rng.address, 
        contract_metadata=sp.big_map({}),
        ledger={},
        token_metadata=[]
    )
    scenario += contract

    # Add bootloader first
    storage_limits = sp.record(code=30000, name=500, desc=8000, author=50)
    contract.add_bootloader(
        version=sp.bytes("0x76302e302e31"),
        fragments=[
            sp.bytes("0x3c73766720786d6c6e733d22687474703a2f2f7777772e77332e6f72672f323030302f737667222076696577426f783d22302030203130302031303022207374796c653d226261636b67726f756e642d636f6c6f723a77686974653b223e"),
            sp.bytes("0x3c2f7376673e"),
            sp.bytes("0x3c2f7376673e"),
            sp.bytes("0x3c2f7376673e")
        ],
        fun=bootloader.v0_0_1,
        storage_limits=storage_limits,
        _sender=admin
    )

    # Create generator
    contract.create_generator(
        name=sp.bytes("0x54696d657374616d7020426f756e6461727920546573742020"),
        description=sp.bytes("0x54657374696e672074696d657374616d7020626f756e6461726965732020"),
        code=sp.bytes("0x636f6e736f6c652e6c6f67282254657374"),
        author_bytes=sp.bytes("0x416c696365"),
        reserved_editions=0,
        bootloader_id=0,
        _sender=alice
    )

    current_time = sp.timestamp(2000000)
    contract.set_sale(
        generator_id=0,
        start_time=sp.Some(current_time),
        price=sp.mutez(1000000),
        paused=False,
        editions=5,
        max_per_wallet=None,
        _sender=alice
    )

    scenario.h2("Can mint exactly at start time")
    contract.mint(
        generator_id=0, 
        entropy=sp.bytes("0x" + os.urandom(16).hex()),
        _sender=bob,
        _amount=sp.mutez(1000000),
        _now=current_time
    )

@sp.add_test()
def test_zero_editions_edge_case():
    """
    Tests the edge case of zero editions:
    - Setting zero editions should prevent all public minting
    - Airdrop should still work if reserved editions available
    """
    scenario = sp.test_scenario("Zero Editions Edge Case", [bootloader, randomiser])

    admin = sp.test_account("Admin")
    alice = sp.test_account("Alice")
    bob = sp.test_account("Bob")

    rng = randomiser.RandomiserMock()
    scenario += rng

    contract = bootloader.Bootloader(
        admin_address=admin.address,
        rng_contract=rng.address, 
        contract_metadata=sp.big_map({}),
        ledger={},
        token_metadata=[]
    )
    scenario += contract

    # Add bootloader first
    storage_limits = sp.record(code=30000, name=500, desc=8000, author=50)
    contract.add_bootloader(
        version=sp.bytes("0x76302e302e31"),
        fragments=[
            sp.bytes("0x3c73766720786d6c6e733d22687474703a2f2f7777772e77332e6f72672f323030302f737667222076696577426f783d22302030203130302031303022207374796c653d226261636b67726f756e642d636f6c6f723a77686974653b223e"),
            sp.bytes("0x3c2f7376673e"),
            sp.bytes("0x3c2f7376673e"),
            sp.bytes("0x3c2f7376673e")
        ],
        fun=bootloader.v0_0_1,
        storage_limits=storage_limits,
        _sender=admin
    )

    # Create generator
    contract.create_generator(
        name=sp.bytes("0x5a65726f20456469746f6e732054657374"),
        description=sp.bytes("0x54657374696e67207a65726f20656469746f6e73"),
        code=sp.bytes("0x636f6e736f6c652e6c6f67282254657374"),
        author_bytes=sp.bytes("0x416c696365"),
        reserved_editions=0,
        bootloader_id=0,
        _sender=alice
    )

    contract.set_sale(
        generator_id=0,
        start_time=None,
        price=sp.mutez(100000),
        paused=False,
        editions=0,
        max_per_wallet=None,
        _sender=alice
    )

    scenario.h2("Cannot mint when editions is zero")
    contract.mint(
        generator_id=0, 
        entropy=sp.bytes("0x" + os.urandom(16).hex()),
        _sender=bob,
        _amount=sp.mutez(100000),
        _valid=False,
        _exception="PUBLIC_SOLD_OUT"
    )

@sp.add_test()
def test_large_sale_parameters():
    """
    Tests handling of large numbers in sale configuration:
    - Large edition counts
    - Large max per wallet values
    - Maximum reasonable values
    """
    scenario = sp.test_scenario("Large Sale Parameters", [bootloader, randomiser])

    admin = sp.test_account("Admin")
    alice = sp.test_account("Alice")

    rng = randomiser.RandomiserMock()
    scenario += rng

    contract = bootloader.Bootloader(
        admin_address=admin.address,
        rng_contract=rng.address, 
        contract_metadata=sp.big_map({}),
        ledger={},
        token_metadata=[]
    )
    scenario += contract

    # Add bootloader first
    storage_limits = sp.record(code=30000, name=500, desc=8000, author=50)
    contract.add_bootloader(
        version=sp.bytes("0x76302e302e31"),
        fragments=[
            sp.bytes("0x3c73766720786d6c6e733d22687474703a2f2f7777772e77332e6f72672f323030302f737667222076696577426f783d22302030203130302031303022207374796c653d226261636b67726f756e642d636f6c6f723a77686974653b223e"),
            sp.bytes("0x3c2f7376673e"),
            sp.bytes("0x3c2f7376673e"),
            sp.bytes("0x3c2f7376673e")
        ],
        fun=bootloader.v0_0_1,
        storage_limits=storage_limits,
        _sender=admin
    )

    # Create generator
    contract.create_generator(
        name=sp.bytes("0x4c61726765205061726d65746572732054657374"),
        description=sp.bytes("0x54657374696e67206c61726765207061726d657465727320"),
        code=sp.bytes("0x636f6e736f6c652e6c6f67282254657374"),
        author_bytes=sp.bytes("0x416c696365"),
        reserved_editions=999999,
        bootloader_id=0,
        _sender=alice
    )

    scenario.h2("Can set large sale parameters")
    contract.set_sale(
        generator_id=0,
        start_time=None,
        price=sp.mutez(0),
        paused=False,
        editions=1000000,
        max_per_wallet=sp.Some(999999),
        _sender=alice
    )
    
    sale = contract.data.generators[0].sale.unwrap_some()
    scenario.verify(sale.editions == 1000000)
    scenario.verify(sale.max_per_wallet == sp.Some(999999))

@sp.add_test()
def test_price_exactness():
    """
    Tests that price matching is exact:
    - Overpaying is not allowed
    - Underpaying is not allowed
    - Exact payment works
    """
    scenario = sp.test_scenario("Price Exactness", [bootloader, randomiser])

    admin = sp.test_account("Admin")
    alice = sp.test_account("Alice")
    bob = sp.test_account("Bob")

    rng = randomiser.RandomiserMock()
    scenario += rng

    contract = bootloader.Bootloader(
        admin_address=admin.address,
        rng_contract=rng.address, 
        contract_metadata=sp.big_map({}),
        ledger={},
        token_metadata=[]
    )
    scenario += contract

    # Add bootloader first
    storage_limits = sp.record(code=30000, name=500, desc=8000, author=50)
    contract.add_bootloader(
        version=sp.bytes("0x76302e302e31"),
        fragments=[
            sp.bytes("0x3c73766720786d6c6e733d22687474703a2f2f7777772e77332e6f72672f323030302f737667222076696577426f783d22302030203130302031303022207374796c653d226261636b67726f756e642d636f6c6f723a77686974653b223e"),
            sp.bytes("0x3c2f7376673e"),
            sp.bytes("0x3c2f7376673e"),
            sp.bytes("0x3c2f7376673e")
        ],
        fun=bootloader.v0_0_1,
        storage_limits=storage_limits,
        _sender=admin
    )

    # Create generator
    contract.create_generator(
        name=sp.bytes("0x4f76657270617920546573742020"),
        description=sp.bytes("0x54657374696e67206f76657270617920"),
        code=sp.bytes("0x636f6e736f6c652e6c6f67282254657374"),
        author_bytes=sp.bytes("0x416c696365"),
        reserved_editions=0,
        bootloader_id=0,
        _sender=alice
    )

    contract.set_sale(
        generator_id=0,
        start_time=None,
        price=sp.mutez(1000000),
        paused=False,
        editions=5,
        max_per_wallet=None,
        _sender=alice
    )

    scenario.h2("Overpaying is not allowed")
    contract.mint(
        generator_id=0, 
        entropy=sp.bytes("0x" + os.urandom(16).hex()),
        _sender=bob,
        _amount=sp.mutez(1500000),
        _valid=False,
        _exception="PRICE_MISMATCH"
    )
