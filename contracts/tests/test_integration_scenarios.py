"""
Integration Scenarios Tests

This module tests complex integration scenarios that involve multiple contract features:
- End-to-end workflows
- Cross-feature interactions
- Complex state transitions
- Real-world usage patterns
- Performance and scalability scenarios
"""

from bootloader import bootloader
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

@sp.add_test()
def test_complete_platform_workflow():
    """
    Tests a complete platform workflow from setup to token generation:
    - Admin sets up platform (bootloader, metadata, treasury, fees)
    - Artist creates and configures generator
    - Users mint tokens with payments
    - Artist airdrops reserved editions
    - Tokens are transferred and regenerated
    """
    scenario = sp.test_scenario("Complete Platform Workflow", [bootloader, randomiser])

    admin = sp.test_account("Admin")
    artist = sp.test_account("Artist")
    collector1 = sp.test_account("Collector1")
    collector2 = sp.test_account("Collector2")
    moderator = sp.test_account("Moderator")

    treasury = test_utils.BalanceCounter()
    scenario += treasury

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

    scenario.h1("Phase 1: Platform Setup")
    
    scenario.h2("Admin sets up platform metadata")
    contract.set_metadata(
        {
            "name": sp.bytes("0x426f6f746c6f61646572204e4654"),
            "description": sp.bytes("0x47656e657261746976652041727420506c6174666f726d"),
            "version": sp.bytes("0x76312e302e30"),
        },
        _sender=admin
    )

    scenario.h2("Admin adds moderator")
    contract.add_moderator(moderator.address, _sender=admin)

    scenario.h2("Admin sets treasury and platform fee")
    contract.set_treasury(treasury.address, _sender=admin)
    contract.set_platform_fee_bps(1000, _sender=admin)  # 10%

    scenario.h2("Admin adds bootloader")
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

    scenario.h1("Phase 2: Artist Creates Generator")

    scenario.h2("Artist creates generator with reserved editions")
    contract.create_generator(
        name=sp.bytes("0x4d79204172742047656e657261746f72"),
        description=sp.bytes("0x412062656175746966756c2067656e657261746976652061727420636f6c6c656374696f6e"),
        code=sp.bytes("0x636f6e736f6c652e6c6f67282247656e657261746976652041727422"),
        author_bytes=sp.bytes("0x4172746973744e616d65"),
        reserved_editions=10,
        bootloader_id=0,
        _sender=artist
    )

    scenario.h2("Artist configures sale")
    contract.set_sale(
        generator_id=0,
        start_time=None,
        price=sp.mutez(5000000),  # 5 XTZ
        paused=False,
        editions=100,
        max_per_wallet=sp.Some(3),
        _sender=artist
    )

    scenario.h1("Phase 3: Public Minting")

    scenario.h2("Collector 1 mints tokens")
    for i in range(2):
        contract.mint(
            generator_id=0, 
            entropy=sp.bytes("0x" + f"{i:02x}" * 16),
            _sender=collector1,
            _amount=sp.mutez(5000000)
        )

    scenario.h2("Collector 2 mints tokens")
    contract.mint(
        generator_id=0, 
        entropy=sp.bytes("0x" + "ff" * 16),
        _sender=collector2,
        _amount=sp.mutez(5000000)
    )

    scenario.h2("Verify payments distributed correctly")
    # 3 mints * 5 XTZ = 15 XTZ total
    # 10% platform fee = 1.5 XTZ to treasury
    # 13.5 XTZ to artist
    expected_treasury = sp.mutez(1500000)
    scenario.verify(treasury.data == expected_treasury)

    scenario.h1("Phase 4: Artist Airdrops")

    scenario.h2("Artist airdrops reserved editions")
    for i in range(3):
        contract.airdrop(
            generator_id=0,
            recipient=collector2.address,
            entropy=sp.bytes("0x" + f"{i+10:02x}" * 16),
            _sender=artist
        )

    scenario.verify(contract.data.generators[0].reserved_editions == 7)
    scenario.verify(contract.data.generators[0].n_tokens == 6)

    scenario.h1("Phase 5: Secondary Market Activity")

    scenario.h2("Collector transfers token")
    contract.transfer([
        sp.record(
            from_=collector1.address,
            txs=[sp.record(to_=collector2.address, token_id=0, amount=1)]
        )
    ], _sender=collector1)

    scenario.verify(contract.data.ledger[0] == collector2.address)

    scenario.h1("Phase 6: Generator Updates and Regeneration")

    scenario.h2("Artist updates generator")
    contract.update_generator(
        generator_id=0,
        name=sp.bytes("0x4d79204172742047656e657261746f72205632"),
        description=sp.bytes("0x557064617465642067656e657261746f72207769746820696d70726f76656d656e7473"),
        code=sp.bytes("0x636f6e736f6c652e6c6f67282247656e657261746976652041727420563222"),
        author_bytes=sp.bytes("0x4172746973744e616d65"),
        reserved_editions=7,
        _sender=artist
    )

    scenario.h2("Token owners regenerate their tokens")
    contract.regenerate_token(0, _sender=collector2)
    contract.regenerate_token(1, _sender=collector1)

    scenario.verify(contract.data.token_extra[0].generator_version == 2)
    scenario.verify(contract.data.token_extra[1].generator_version == 2)

    scenario.h1("Phase 7: Moderation")

    scenario.h2("Moderator flags generator")
    contract.flag_generator(generator_id=0, flag=1, _sender=moderator)
    scenario.verify(contract.data.generators[0].flag == 1)

    scenario.h2("Moderator updates thumbnail")
    contract.update_thumbnail(
        token_id=0,
        thumbnailUri=sp.bytes("0x68747470733a2f2f6e65772d7468756d626e61696c2e636f6d"),
        _sender=moderator
    )

@sp.add_test()
def test_multi_generator_ecosystem():
    """
    Tests a complex ecosystem with multiple generators and interactions:
    - Multiple artists with different generators
    - Different pricing and edition strategies
    - Cross-generator interactions
    - Platform fee distribution across multiple sales
    """
    scenario = sp.test_scenario("Multi-Generator Ecosystem", [bootloader, randomiser])

    admin = sp.test_account("Admin")
    artist1 = sp.test_account("Artist1")
    artist2 = sp.test_account("Artist2")
    artist3 = sp.test_account("Artist3")
    collector = sp.test_account("Collector")

    treasury = test_utils.BalanceCounter()
    scenario += treasury

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

    # Setup platform
    contract.set_treasury(treasury.address, _sender=admin)
    contract.set_platform_fee_bps(500, _sender=admin)  # 5%

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

    scenario.h2("Artist 1: Premium limited edition")
    contract.create_generator(
        name=sp.bytes("0x5072656d69756d204172742020"),
        description=sp.bytes("0x4c696d6974656420656469746f6e207072656d69756d20617274"),
        code=sp.bytes("0x636f6e736f6c652e6c6f67282250726d69756d22"),
        author_bytes=sp.bytes("0x4172746973743120"),
        reserved_editions=5,
        bootloader_id=0,
        _sender=artist1
    )

    contract.set_sale(
        generator_id=0,
        start_time=None,
        price=sp.mutez(10000000),  # 10 XTZ
        paused=False,
        editions=25,
        max_per_wallet=sp.Some(1),
        _sender=artist1
    )

    scenario.h2("Artist 2: Mid-tier open edition")
    contract.create_generator(
        name=sp.bytes("0x4d69642d5469657220417274"),
        description=sp.bytes("0x4d69642d7469657220617274207769746820726561736f6e61626c652070726963696e67"),
        code=sp.bytes("0x636f6e736f6c652e6c6f67282254696572322229"),
        author_bytes=sp.bytes("0x4172746973743220"),
        reserved_editions=0,
        bootloader_id=0,
        _sender=artist2
    )

    contract.set_sale(
        generator_id=1,
        start_time=None,
        price=sp.mutez(2000000),  # 2 XTZ
        paused=False,
        editions=1000,
        max_per_wallet=None,
        _sender=artist2
    )

    scenario.h2("Artist 3: Free community art")
    contract.create_generator(
        name=sp.bytes("0x436f6d6d756e69747920417274"),
        description=sp.bytes("0x46726565206172742066726f6d20746865206172746973742020"),
        code=sp.bytes("0x636f6e736f6c652e6c6f67282246726565222020"),
        author_bytes=sp.bytes("0x4172746973743320"),
        reserved_editions=50,
        bootloader_id=0,
        _sender=artist3
    )

    contract.set_sale(
        generator_id=2,
        start_time=None,
        price=sp.mutez(0),  # Free
        paused=False,
        editions=500,
        max_per_wallet=sp.Some(5),
        _sender=artist3
    )

    scenario.h2("Collector mints from all generators")
    # Premium art
    contract.mint(
        generator_id=0, 
        entropy=sp.bytes("0x" + "01" * 16),
        _sender=collector,
        _amount=sp.mutez(10000000)
    )

    # Mid-tier art (multiple)
    for i in range(3):
        contract.mint(
            generator_id=1, 
            entropy=sp.bytes("0x" + f"{i+10:02x}" * 16),
            _sender=collector,
            _amount=sp.mutez(2000000)
        )

    # Free art (multiple)
    for i in range(5):
        contract.mint(
            generator_id=2, 
            entropy=sp.bytes("0x" + f"{i+20:02x}" * 16),
            _sender=collector,
            _amount=sp.mutez(0)
        )

    scenario.h2("Verify platform fees collected correctly")
    # Premium: 10 XTZ * 5% = 0.5 XTZ
    # Mid-tier: 3 * 2 XTZ * 5% = 0.3 XTZ
    # Free: 0 XTZ
    # Total platform fees: 0.8 XTZ
    expected_treasury = sp.mutez(800000)
    scenario.verify(treasury.data == expected_treasury)

    scenario.h2("Artists airdrop to build community")
    # Artist 1 airdrops premium piece
    contract.airdrop(
        generator_id=0,
        recipient=collector.address,
        entropy=sp.bytes("0x" + "aa" * 16),
        _sender=artist1
    )

    # Artist 3 airdrops community pieces
    for i in range(10):
        contract.airdrop(
            generator_id=2,
            recipient=collector.address,
            entropy=sp.bytes("0x" + f"{i+30:02x}" * 16),
            _sender=artist3
        )

    scenario.h2("Verify final state")
    scenario.verify(contract.data.next_token_id == 20)  # 1 + 3 + 5 + 1 + 10
    scenario.verify(contract.data.generators[0].n_tokens == 2)  # 1 mint + 1 airdrop
    scenario.verify(contract.data.generators[1].n_tokens == 3)  # 3 mints
    scenario.verify(contract.data.generators[2].n_tokens == 15)  # 5 mints + 10 airdrops

@sp.add_test()
def test_platform_evolution_scenario():
    """
    Tests platform evolution over time:
    - Platform starts with basic setup
    - Features are added incrementally
    - Settings are updated as platform grows
    - Migration scenarios
    """
    scenario = sp.test_scenario("Platform Evolution", [bootloader, randomiser])

    admin = sp.test_account("Admin")
    artist = sp.test_account("Artist")
    collector = sp.test_account("Collector")

    treasury1 = test_utils.BalanceCounter()
    scenario += treasury1
    
    treasury2 = test_utils.BalanceCounter()
    scenario += treasury2

    rng1 = randomiser.RandomiserMock()
    scenario += rng1
    
    rng2 = randomiser.RandomiserMock()
    scenario += rng2

    contract = bootloader.Bootloader(
        admin_address=admin.address,
        rng_contract=rng1.address, 
        contract_metadata=sp.big_map({}),
        ledger=sp.map({}),
        token_metadata=[]
    )
    scenario += contract

    scenario.h1("Phase 1: Platform Launch")

    scenario.h2("Initial setup with basic bootloader")
    test_fragments = [
        sp.bytes("0x3c73766720786d6c6e733d22687474703a2f2f7777772e77332e6f72672f323030302f737667222076696577426f783d22302030203130302031303022207374796c653d226261636b67726f756e642d636f6c6f723a77686974653b223e"),
        sp.bytes("0x3c2f7376673e"),
        sp.bytes("0x3c67207374796c653d2266696c6c3a7265643b223e"),
        sp.bytes("0x3c2f673e")
    ]

    contract.add_bootloader(
        version=sp.bytes("0x76302e312e30"),  # v0.1.0
        fragments=test_fragments,
        fun=bootloader.v0_0_1,
        storage_limits=sp.record(code=10000, name=100, desc=1000, author=30),
        _sender=admin
    )

    contract.set_treasury(treasury1.address, _sender=admin)
    contract.set_platform_fee_bps(2000, _sender=admin)  # 20% initially

    scenario.h2("Early artist creates simple generator")
    contract.create_generator(
        name=sp.bytes("0x4561726c79204172742020"),
        description=sp.bytes("0x53696d706c652067656e657261746f72"),
        code=sp.bytes("0x636f6e736f6c652e6c6f67282245617279222020"),
        author_bytes=sp.bytes("0x4172746973742020"),
        reserved_editions=0,
        bootloader_id=0,
        _sender=artist
    )

    contract.set_sale(
        generator_id=0,
        start_time=None,
        price=sp.mutez(1000000),
        paused=False,
        editions=10,
        max_per_wallet=None,
        _sender=artist
    )

    contract.mint(
        generator_id=0, 
        entropy=sp.bytes("0x" + "01" * 16),
        _sender=collector,
        _amount=sp.mutez(1000000)
    )

    scenario.h1("Phase 2: Platform Growth")

    scenario.h2("Reduce platform fees as platform grows")
    contract.set_platform_fee_bps(1000, _sender=admin)  # 10%

    scenario.h2("Add improved bootloader with more features")
    contract.add_bootloader(
        version=sp.bytes("0x76312e302e30"),  # v1.0.0
        fragments=test_fragments,
        fun=bootloader.v0_0_1_ghostnet,
        storage_limits=sp.record(code=30000, name=500, desc=8000, author=50),
        _sender=admin
    )

    scenario.h2("Artist creates more sophisticated generator")
    contract.create_generator(
        name=sp.bytes("0x416476616e6365642041727420436f6c6c656374696f6e"),
        description=sp.bytes("0x4d6f726520736f70686973746963617465642067656e657261746f72207769746820616476616e63656420666561747572657320616e64206c6f6e67657220646573637269707469"),
        code=sp.bytes("0x636f6e736f6c652e6c6f67282241647620417274222020"),
        author_bytes=sp.bytes("0x4172746973744e616d6520"),
        reserved_editions=20,
        bootloader_id=1,  # Use new bootloader
        _sender=artist
    )

    contract.set_sale(
        generator_id=1,
        start_time=None,
        price=sp.mutez(3000000),
        paused=False,
        editions=100,
        max_per_wallet=sp.Some(2),
        _sender=artist
    )

    contract.mint(
        generator_id=1, 
        entropy=sp.bytes("0x" + "02" * 16),
        _sender=collector,
        _amount=sp.mutez(3000000)
    )

    scenario.h1("Phase 3: Platform Maturity")

    scenario.h2("Switch to new treasury")
    contract.set_treasury(treasury2.address, _sender=admin)

    scenario.h2("Upgrade RNG system")
    contract.set_rng_contract(rng2.address, _sender=admin)

    scenario.h2("Further reduce platform fees")
    contract.set_platform_fee_bps(500, _sender=admin)  # 5%

    scenario.h2("New mints use updated settings")
    contract.mint(
        generator_id=1, 
        entropy=sp.bytes("0x" + "03" * 16),
        _sender=collector,
        _amount=sp.mutez(3000000)
    )

    scenario.h2("Verify treasury distribution")
    # First mint: 1 XTZ * 20% = 0.2 XTZ to treasury1
    # Second mint: 3 XTZ * 10% = 0.3 XTZ to treasury1
    # Third mint: 3 XTZ * 5% = 0.15 XTZ to treasury2
    scenario.verify(treasury1.data == sp.mutez(500000))  # 0.2 + 0.3
    scenario.verify(treasury2.data == sp.mutez(150000))   # 0.15

    scenario.h2("Update platform metadata")
    contract.set_metadata(
        {
            "name": sp.bytes("0x426f6f746c6f61646572204e4654205632"),
            "version": sp.bytes("0x76322e302e30"),
            "features": sp.bytes("0x4d756c74692d626f6f746c6f616465722c20496d70726f76656420524e47"),
        },
        _sender=admin
    )

@sp.add_test()
def test_edge_case_combinations():
    """
    Tests combinations of edge cases:
    - Generator with zero editions and reserved editions
    - Multiple updates and regenerations
    - Complex sale configurations
    - Boundary condition interactions
    """
    scenario = sp.test_scenario("Edge Case Combinations", [bootloader, randomiser])

    admin = sp.test_account("Admin")
    artist = sp.test_account("Artist")
    collector = sp.test_account("Collector")

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

    # Setup
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

    scenario.h2("Generator with only reserved editions")
    contract.create_generator(
        name=sp.bytes("0x526573657276656420456467652043617365"),
        description=sp.bytes("0x47656e657261746f72207769746820f6e6c7920726573657276656420656469746f6e7"),
        code=sp.bytes("0x636f6e736f6c652e6c6f67282252657365727665642229"),
        author_bytes=sp.bytes("0x4172746973742020"),
        reserved_editions=5,
        bootloader_id=0,
        _sender=artist
    )

    # Set sale with editions equal to reserved editions
    contract.set_sale(
        generator_id=0,
        start_time=None,
        price=sp.mutez(1000000),
        paused=False,
        editions=5,  # Same as reserved editions
        max_per_wallet=None,
        _sender=artist
    )

    scenario.h2("Public minting should fail immediately")
    contract.mint(
        generator_id=0, 
        entropy=sp.bytes("0x" + "01" * 16),
        _sender=collector,
        _amount=sp.mutez(1000000),
        _valid=False,
        _exception="PUBLIC_SOLD_OUT"
    )

    scenario.h2("But airdrop should work")
    contract.airdrop(
        generator_id=0,
        recipient=collector.address,
        entropy=sp.bytes("0x" + "02" * 16),
        _sender=artist
    )

    scenario.verify(contract.data.generators[0].n_tokens == 1)
    scenario.verify(contract.data.generators[0].reserved_editions == 4)

    scenario.h2("Multiple generator updates and regenerations")
    # Update generator multiple times
    for version in range(2, 6):
        contract.update_generator(
            generator_id=0,
            name=sp.bytes("0x526573657276656420456467652043617365205632"),
            description=sp.bytes("0x557064617465642067656e657261746f72"),
            code=sp.bytes("0x636f6e736f6c652e6c6f67282256" + f"{version}".encode().hex() + "22"),
            author_bytes=sp.bytes("0x4172746973742020"),
            reserved_editions=4,
            _sender=artist
        )
        
        # Regenerate token with new version
        contract.regenerate_token(0, _sender=collector)
        scenario.verify(contract.data.token_extra[0].generator_version == version)
