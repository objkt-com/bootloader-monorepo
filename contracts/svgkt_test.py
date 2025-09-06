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
            self.data = sp.amount
    
    class FailingTreasury(sp.Contract):
        def __init__(self):
            self.data = ()
        
        @sp.entrypoint
        def default(self):
            raise "TREASURY_REJECTED"
    
    class NoRngContract(sp.Contract):
        def __init__(self):
            self.data = ()

    class MockRngContract(sp.Contract):
        def __init__(self):
            self.data = ()
        
        @sp.onchain_view()
        def rb(self, seed):
            return sp.bytes("0x1234567890abcdef1234567890abcdef")
        
        @sp.entrypoint
        def default(self):
            pass

@sp.add_test()
def test_comprehensive():
    scenario = sp.test_scenario("svgkt_test", [svgkt, randomiser])

    admin = sp.test_account("Admin")
    alice = sp.test_account("Alice")
    bob = sp.test_account("Bob")
    charlie = sp.test_account("Charlie")
    new_admin = sp.test_account("NewAdmin")
    treasury = sp.test_account("Treasury")

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

    scenario.h1("Admin Access Control")
    
    for i in range(4):
        contract.add_fragment(
            frag_id=i, 
            frag=sp.bytes("0x3c73766720786d6c6e733d22687474703a2f2f7777772e77332e6f72672f323030302f737667222076696577426f783d22302030203130302031303022207374796c653d226261636b67726f756e642d636f6c6f723a77686974653b223e"),
            _sender=admin
        )
    
    contract.add_fragment(
        frag_id=10, 
        frag=sp.bytes("0x00"),
        _sender=alice,
        _valid=False,
        _exception="ONLY_MODS"
    )
    
    contract.set_treasury(treasury.address, _sender=admin)
    scenario.verify(contract.data.treasury == treasury.address)
    
    contract.set_treasury(
        alice.address,
        _sender=alice,
        _valid=False,
        _exception="ONLY_MODS"
    )
    
    contract.set_platform_fee_bps(1500, _sender=admin)
    scenario.verify(contract.data.platform_fee_bps == 1500)
    
    contract.set_platform_fee_bps(
        3000,
        _sender=alice,
        _valid=False,
        _exception="ONLY_MODS"
    )
    
    contract.set_administrator(new_admin.address, _sender=admin)
    
    contract.set_treasury(
        alice.address,
        _sender=admin,
        _valid=False,
        _exception="ONLY_MODS"
    )
    
    contract.set_treasury(treasury_counter.address, _sender=new_admin)
    scenario.verify(contract.data.treasury == treasury_counter.address)
    
    contract.set_platform_fee_bps(2500, _sender=new_admin)
    scenario.verify(contract.data.platform_fee_bps == 2500)
    
    scenario.h1("Generator Management")
    
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
    
    contract.update_generator(
        generator_id=0,
        name=sp.bytes("0x416c69636520417274205632"),
        description=sp.bytes("0x557064617465642067656e657261746f72"),
        code=sp.bytes("0x636f6e736f6c652e6c6f67282248656c6c6f20576f726c64205632"),
        author_bytes=sp.bytes("0x416c696365"),
        reserved_editions=0,
        _sender=alice
    )
    
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
    
    scenario.h1("Sale States")
    
    contract.mint(
        generator_id=0, 
        entropy=sp.bytes("0x" + os.urandom(16).hex()),
        _sender=bob,
        _valid=False,
        _exception="NO_SALE_CONFIG"
    )
    
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
    
    contract.mint(
        generator_id=0, 
        entropy=sp.bytes("0x" + os.urandom(16).hex()),
        _sender=bob,
        _amount=sp.mutez(500000),
        _now=sp.timestamp(250),
        _valid=False,
        _exception="PRICE_MISMATCH"
    )
    
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
    scenario.verify(contract.data.token_extra[0].generator_id == 0)
    
    scenario.h1("Free Minting")
    
    contract.create_generator(
        name=sp.bytes("0x46726565204172742047656e"),
        description=sp.bytes("0x46726565206d696e74696e672067656e657261746f72"),
        code=sp.bytes("0x636f6e736f6c652e6c6f67282246726565204172742229"),
        author_bytes=sp.bytes("0x416c696365"),
        reserved_editions=0,
        _sender=alice
    )
    
    contract.set_sale(
        generator_id=1,
        start_time=None,
        price=sp.mutez(0),
        paused=False,
        editions=50,
        max_per_wallet=None,
        _sender=alice
    )
    
    contract.mint(
        generator_id=1, 
        entropy=sp.bytes("0x" + os.urandom(16).hex()),
        _sender=charlie,
        _amount=sp.mutez(0)
    )
    
    contract.mint(
        generator_id=1,
        entropy=sp.bytes("0x" + os.urandom(16).hex()),
        _sender=bob,
        _amount=sp.mutez(1),
        _valid=False,
        _exception="PRICE_MISMATCH"
    )
    
    scenario.h1("Edition Limits")
    
    contract.create_generator(
        name=sp.bytes("0x4c696d69746564204172742047656e"),
        description=sp.bytes("0x4c696d697465642065646974696f6e2067656e657261746f72"),
        code=sp.bytes("0x636f6e736f6c652e6c6f67282253636172636520417274"),
        author_bytes=sp.bytes("0x416c696365"),
        reserved_editions=0,
        _sender=alice
    )
    
    contract.set_sale(
        generator_id=2,
        start_time=None,
        price=sp.mutez(500000),
        paused=False,
        editions=2,
        max_per_wallet=None,
        _sender=alice
    )
    
    contract.mint(
        generator_id=2, 
        entropy=sp.bytes("0x" + os.urandom(16).hex()),
        _sender=bob,
        _amount=sp.mutez(500000)
    )
    
    contract.mint(
        generator_id=2, 
        entropy=sp.bytes("0x" + os.urandom(16).hex()),
        _sender=charlie,
        _amount=sp.mutez(500000)
    )
    
    contract.mint(
        generator_id=2, 
        entropy=sp.bytes("0x" + os.urandom(16).hex()),
        _sender=alice,
        _amount=sp.mutez(500000),
        _valid=False,
        _exception="SOLD_OUT"
    )
    
    scenario.h1("Edition Reduction")
    
    contract.create_generator(
        name=sp.bytes("0x456469746f6e2054657374"),
        description=sp.bytes("0x54657374696e672065646974696f6e206368616e676573"),
        code=sp.bytes("0x636f6e736f6c652e6c6f67282245646974696f6e2054657374"),
        author_bytes=sp.bytes("0x416c696365"),
        reserved_editions=0,
        _sender=alice
    )
    
    contract.set_sale(
        generator_id=3,
        start_time=None,
        price=sp.mutez(100000),
        paused=False,
        editions=100,
        max_per_wallet=None,
        _sender=alice
    )
    
    contract.set_sale(
        generator_id=3,
        start_time=None,
        price=sp.mutez(100000),
        paused=False,
        editions=50,
        max_per_wallet=None,
        _sender=alice
    )
    
    contract.mint(
        generator_id=3, 
        entropy=sp.bytes("0x" + os.urandom(16).hex()),
        _sender=bob,
        _amount=sp.mutez(100000)
    )
    
    contract.set_sale(
        generator_id=3,
        start_time=None,
        price=sp.mutez(100000),
        paused=False,
        editions=25,
        max_per_wallet=None,
        _sender=alice
    )
    
    contract.set_sale(
        generator_id=3,
        start_time=None,
        price=sp.mutez(100000),
        paused=False,
        editions=75,
        max_per_wallet=None,
        _sender=alice,
        _valid=False,
        _exception="NO_ED_INCREMENT"
    )
    
    scenario.h1("Airdrop")
    
    contract.airdrop(
        generator_id=3,
        recipient=charlie.address,
        entropy=sp.bytes("0x" + os.urandom(16).hex()),
        _sender=alice
    )
    
    contract.airdrop(
        generator_id=3,
        recipient=bob.address,
        entropy=sp.bytes("0x" + os.urandom(16).hex()),
        _sender=bob,
        _valid=False,
        _exception="ONLY_AUTHOR"
    )
    
    for i in range(23):
        contract.mint(
            generator_id=3, 
            entropy=sp.bytes("0x" + os.urandom(16).hex()),
            _sender=bob,
            _amount=sp.mutez(100000)
        )
    
    contract.airdrop(
        generator_id=3,
        recipient=charlie.address,
        entropy=sp.bytes("0x" + os.urandom(16).hex()),
        _sender=alice,
        _valid=False,
        _exception="SOLD_OUT"
    )
    
    scenario.h1("Platform Fees")
    
    contract.create_generator(
        name=sp.bytes("0x466565205465737420417274"),
        description=sp.bytes("0x54657374696e672066656520646973747269627574696f6e"),
        code=sp.bytes("0x636f6e736f6c652e6c6f67282246656520546573742229"),
        author_bytes=sp.bytes("0x426f62"),
        reserved_editions=0,
        _sender=bob
    )
    
    contract.set_sale(
        generator_id=4,
        start_time=None,
        price=sp.mutez(10000000),
        paused=False,
        editions=10,
        max_per_wallet=None,
        _sender=bob
    )
    
    contract.mint(
        generator_id=4, 
        entropy=sp.bytes("0x" + os.urandom(16).hex()),
        _sender=charlie,
        _amount=sp.mutez(10000000)
    )
    
    expected_platform_fee = sp.mutez(2500000)
    scenario.verify(treasury_counter.data == expected_platform_fee)
    
    contract.set_platform_fee_bps(10000, _sender=new_admin)
    scenario.verify(contract.data.platform_fee_bps == 10000)
    
    contract.create_generator(
        name=sp.bytes("0x4d617820466565205465737420"),
        description=sp.bytes("0x54657374696e67206d617820666565"),
        code=sp.bytes("0x636f6e736f6c652e6c6f67282254657374"),
        author_bytes=sp.bytes("0x416c696365"),
        reserved_editions=0,
        _sender=alice
    )
    
    contract.set_sale(
        generator_id=5,
        start_time=None,
        price=sp.mutez(1000000),
        paused=False,
        editions=5,
        max_per_wallet=None,
        _sender=alice
    )
    
    treasury_counter.default(_amount=sp.mutez(0))
    
    contract.mint(
        generator_id=5, 
        entropy=sp.bytes("0x" + os.urandom(16).hex()),
        _sender=bob,
        _amount=sp.mutez(1000000)
    )
    
    scenario.verify(treasury_counter.data == sp.mutez(1000000))
    
    contract.set_platform_fee_bps(
        10001,
        _sender=new_admin,
        _valid=False,
        _exception="BPS_TOO_HIGH"
    )
    
    contract.set_platform_fee_bps(2500, _sender=new_admin)
    
    scenario.h1("Edge Cases")
    
    contract.create_generator(
        name=sp.bytes("0x456469746f6e20526564756374696f6e2054657374"),
        description=sp.bytes("0x54657374696e672065646974696f6e20726564756374696f6e"),
        code=sp.bytes("0x636f6e736f6c652e6c6f67282254657374"),
        author_bytes=sp.bytes("0x416c696365"),
        reserved_editions=0,
        _sender=alice
    )
    
    contract.set_sale(
        generator_id=6,
        start_time=None,
        price=sp.mutez(100000),
        paused=False,
        editions=10,
        max_per_wallet=None,
        _sender=alice
    )
    
    for i in range(3):
        contract.mint(
            generator_id=6, 
            entropy=sp.bytes("0x" + os.urandom(16).hex()),
            _sender=bob,
            _amount=sp.mutez(100000)
        )
    
    contract.set_sale(
        generator_id=6,
        start_time=None,
        price=sp.mutez(100000),
        paused=False,
        editions=2,
        _sender=alice,
        _valid=False,
        _exception="ED_LT_MINTED"
    )
    
    contract.set_sale(
        generator_id=6,
        start_time=None,
        price=sp.mutez(100000),
        paused=False,
        editions=3,
        _sender=alice
    )
    
    contract.mint(
        generator_id=6, 
        entropy=sp.bytes("0x" + os.urandom(16).hex()),
        _sender=charlie,
        _amount=sp.mutez(100000),
        _valid=False,
        _exception="SOLD_OUT"
    )
    
    contract.set_sale(
        generator_id=0,
        start_time=None,
        price=sp.mutez(2000000),
        paused=False,
        editions=50,
        _sender=bob,
        _valid=False,
        _exception="ONLY_AUTHOR"
    )
    
    scenario.h1("Input Validation")
    
    long_name = sp.bytes("0x" + "41" * 501)
    contract.create_generator(
        name=long_name,
        description=sp.bytes("0x54657374"),
        code=sp.bytes("0x636f6e736f6c652e6c6f67282254657374"),
        author_bytes=sp.bytes("0x416c696365"),
        _sender=alice,
        _valid=False,
        _exception="NAME_TOO_LONG"
    )
    
    long_desc = sp.bytes("0x" + "41" * 8001)
    contract.create_generator(
        name=sp.bytes("0x54657374"),
        description=long_desc,
        code=sp.bytes("0x636f6e736f6c652e6c6f67282254657374"),
        author_bytes=sp.bytes("0x416c696365"),
        _sender=alice,
        _valid=False,
        _exception="DESC_TOO_LONG"
    )
    
    long_code = sp.bytes("0x" + "41" * 30001)
    contract.create_generator(
        name=sp.bytes("0x54657374"),
        description=sp.bytes("0x54657374"),
        code=long_code,
        author_bytes=sp.bytes("0x416c696365"),
        _sender=alice,
        _valid=False,
        _exception="CODE_TOO_LONG"
    )
    
    scenario.h1("External Dependencies")
    
    contract_no_frags = svgkt.SvgKT(
        admin_address=admin.address,
        rng_contract=rng.address, 
        contract_metadata=sp.big_map({}),
        ledger=sp.map({}),
        token_metadata=[]
    )
    scenario += contract_no_frags
    
    contract_no_frags.add_fragment(
        frag_id=0, 
        frag=sp.bytes("0x3c73766720786d6c6e733d22687474703a2f2f7777772e77332e6f72672f323030302f737667222076696577426f783d22302030203130302031303022207374796c653d226261636b67726f756e642d636f6c6f723a77686974653b223e"),
        _sender=admin
    )
    
    contract_no_frags.create_generator(
        name=sp.bytes("0x4672616720546573742047656e"),
        description=sp.bytes("0x54657374696e67206672616773"),
        code=sp.bytes("0x636f6e736f6c652e6c6f67282254657374"),
        author_bytes=sp.bytes("0x416c696365"),
        _sender=alice
    )
    
    contract_no_frags.set_sale(
        generator_id=0,
        start_time=None,
        price=sp.mutez(0),
        paused=False,
        editions=1,
        _sender=alice
    )
    
    contract_no_frags.mint(
        generator_id=0, 
        entropy=sp.bytes("0x" + os.urandom(16).hex()),
        _sender=bob,
        _amount=sp.mutez(0),
        _valid=False
    )
    
    no_rng_contract = test_utils.NoRngContract()
    scenario += no_rng_contract
    
    contract_no_rng = svgkt.SvgKT(
        admin_address=admin.address,
        rng_contract=no_rng_contract.address, 
        contract_metadata=sp.big_map({}),
        ledger=sp.map({}),
        token_metadata=[]
    )
    scenario += contract_no_rng
    
    for i in range(4):
        contract_no_rng.add_fragment(
            frag_id=i, 
            frag=sp.bytes("0x3c73766720786d6c6e733d22687474703a2f2f7777772e77332e6f72672f323030302f737667222076696577426f783d22302030203130302031303022207374796c653d226261636b67726f756e642d636f6c6f723a77686974653b223e"),
            _sender=admin
        )
    
    contract_no_rng.create_generator(
        name=sp.bytes("0x4e6f20524e472054657374"),
        description=sp.bytes("0x54657374696e67206e6f20524e47"),
        code=sp.bytes("0x636f6e736f6c652e6c6f67282254657374"),
        author_bytes=sp.bytes("0x416c696365"),
        _sender=alice
    )
    
    contract_no_rng.set_sale(
        generator_id=0,
        start_time=None,
        price=sp.mutez(0),
        paused=False,
        editions=1,
        _sender=alice
    )
    
    contract_no_rng.mint(
        generator_id=0, 
        entropy=sp.bytes("0x" + os.urandom(16).hex()),
        _sender=bob,
        _amount=sp.mutez(0),
        _valid=False
    )
    
    failing_treasury = test_utils.FailingTreasury()
    scenario += failing_treasury
    
    contract.set_treasury(failing_treasury.address, _sender=new_admin)
    
    contract.create_generator(
        name=sp.bytes("0x4661696c696e6720547265617375727920546573742020"),
        description=sp.bytes("0x54657374696e67207061796d656e74206661696c757265"),
        code=sp.bytes("0x636f6e736f6c652e6c6f67282254657374"),
        author_bytes=sp.bytes("0x416c696365"),
        _sender=alice
    )
    
    contract.set_sale(
        generator_id=7,
        start_time=None,
        price=sp.mutez(1000000),
        paused=False,
        editions=5,
        _sender=alice
    )
    
    contract.mint(
        generator_id=7, 
        entropy=sp.bytes("0x" + os.urandom(16).hex()),
        _sender=bob,
        _amount=sp.mutez(1000000),
        _valid=False,
        _exception="TREASURY_REJECTED"
    )
    
    contract.set_treasury(treasury_counter.address, _sender=new_admin)
    
    scenario.h1("Pause Behavior")
    
    contract.create_generator(
        name=sp.bytes("0x50617573652041697264726f702054657374"),
        description=sp.bytes("0x54657374696e67207061757365642061697264726f70"),
        code=sp.bytes("0x636f6e736f6c652e6c6f67282254657374"),
        author_bytes=sp.bytes("0x416c696365"),
        _sender=alice
    )
    
    contract.set_sale(
        generator_id=8,
        start_time=None,
        price=sp.mutez(1000000),
        paused=True,
        editions=10,
        _sender=alice
    )
    
    contract.airdrop(
        generator_id=8,
        recipient=bob.address,
        entropy=sp.bytes("0x" + os.urandom(16).hex()),
        _sender=alice
    )
    
    contract.mint(
        generator_id=8, 
        entropy=sp.bytes("0x" + os.urandom(16).hex()),
        _sender=charlie,
        _amount=sp.mutez(1000000),
        _valid=False,
        _exception="SALE_PAUSED"
    )
    
    scenario.h1("Timestamp Boundaries")
    
    contract.create_generator(
        name=sp.bytes("0x54696d657374616d7020426f756e6461727920546573742020"),
        description=sp.bytes("0x54657374696e672074696d657374616d7020626f756e6461726965732020"),
        code=sp.bytes("0x636f6e736f6c652e6c6f67282254657374"),
        author_bytes=sp.bytes("0x416c696365"),
        _sender=alice
    )
    
    current_time = sp.timestamp(2000000)
    contract.set_sale(
        generator_id=9,
        start_time=sp.Some(current_time),
        price=sp.mutez(1000000),
        paused=False,
        editions=5,
        _sender=alice
    )
    
    contract.mint(
        generator_id=9, 
        entropy=sp.bytes("0x" + os.urandom(16).hex()),
        _sender=bob,
        _amount=sp.mutez(1000000),
        _now=current_time
    )
    
    scenario.h1("Admin Restrictions")
    
    contract.update_generator(
        generator_id=0,
        name=sp.bytes("0x41646d696e20417474656d7074"),
        description=sp.bytes("0x41646d696e20747279696e6720746f207570646174652020"),
        code=sp.bytes("0x636f6e736f6c652e6c6f67282241646d696e"),
        author_bytes=sp.bytes("0x41646d696e"),
        _sender=new_admin,
        _valid=False,
        _exception="ONLY_AUTHOR"
    )
    
    contract.set_sale(
        generator_id=0,
        start_time=None,
        price=sp.mutez(5000000),
        paused=False,
        editions=200,
        _sender=new_admin,
        _valid=False,
        _exception="ONLY_AUTHOR"
    )
    
    scenario.h1("FA2 Operations")
    
    contract.transfer([
        sp.record(
            from_=bob.address,
            txs=[sp.record(to_=charlie.address, token_id=0, amount=1)]
        )
    ], _sender=bob)
    
    scenario.verify(contract.data.ledger[0] == charlie.address)
    
    contract.burn([sp.record(from_=bob.address, token_id=0, amount=1)], 
                  _sender=bob, _valid=False)
    
    contract.burn([sp.record(from_=charlie.address, token_id=0, amount=1)], 
                  _sender=charlie)
    
    scenario.verify(~contract.data.ledger.contains(0))
    
    scenario.h1("Price Exactness")
    
    contract.create_generator(
        name=sp.bytes("0x4f76657270617920546573742020"),
        description=sp.bytes("0x54657374696e67206f76657270617920"),
        code=sp.bytes("0x636f6e736f6c652e6c6f67282254657374"),
        author_bytes=sp.bytes("0x416c696365"),
        _sender=alice
    )
    
    contract.set_sale(
        generator_id=10,
        start_time=None,
        price=sp.mutez(1000000),
        paused=False,
        editions=5,
        _sender=alice
    )
    
    contract.mint(
        generator_id=10, 
        entropy=sp.bytes("0x" + os.urandom(16).hex()),
        _sender=bob,
        _amount=sp.mutez(1500000),
        _valid=False,
        _exception="PRICE_MISMATCH"
    )
    
    scenario.h1("NEW FEATURES - Moderator System")
    
    moderator = sp.test_account("Moderator")
    
    # Test moderator addition/removal (admin only)
    contract.add_moderator(moderator.address, _sender=new_admin)
    scenario.verify(contract.data.moderators.contains(moderator.address))
    
    contract.add_moderator(
        alice.address,
        _sender=alice,
        _valid=False,
        _exception="ONLY_ADMIN"
    )
    
    # Test moderator permissions
    contract.set_treasury(treasury.address, _sender=moderator)
    scenario.verify(contract.data.treasury == treasury.address)
    
    contract.set_platform_fee_bps(3000, _sender=moderator)
    scenario.verify(contract.data.platform_fee_bps == 3000)
    
    contract.add_fragment(
        frag_id=20, 
        frag=sp.bytes("0x3c2f7376673e"),
        _sender=moderator
    )
    
    contract.set_rng_contract(rng.address, _sender=moderator)
    scenario.verify(contract.data.rng_contract == rng.address)
    
    # Test moderator removal
    contract.remove_moderator(moderator.address, _sender=new_admin)
    scenario.verify(~contract.data.moderators.contains(moderator.address))
    
    contract.remove_moderator(
        alice.address,
        _sender=alice,
        _valid=False,
        _exception="ONLY_ADMIN"
    )
    
    # Test that removed moderator loses permissions
    contract.set_treasury(
        alice.address,
        _sender=moderator,
        _valid=False,
        _exception="ONLY_MODS"
    )
    
    scenario.h1("NEW FEATURES - Reserved Editions")
    
    contract.create_generator(
        name=sp.bytes("0x526573657276656420456469746f6e732054657374"),
        description=sp.bytes("0x54657374696e6720726573657276656420656469746f6e73"),
        code=sp.bytes("0x636f6e736f6c652e6c6f67282254657374"),
        author_bytes=sp.bytes("0x416c696365"),
        reserved_editions=5,
        _sender=alice
    )
    
    scenario.verify(contract.data.generators[11].reserved_editions == 5)
    
    # Test airdrop with reserved editions
    contract.set_sale(
        generator_id=11,
        start_time=None,
        price=sp.mutez(1000000),
        paused=False,
        editions=10,
        max_per_wallet=None,
        _sender=alice
    )
    
    # Airdrop should work with reserved editions
    contract.airdrop(
        generator_id=11,
        recipient=bob.address,
        entropy=sp.bytes("0x" + os.urandom(16).hex()),
        _sender=alice
    )
    
    scenario.verify(contract.data.generators[11].reserved_editions == 4)
    scenario.verify(contract.data.generators[11].n_tokens == 1)
    
    # Test that public minting respects reserved editions
    for i in range(4):  # Should only be able to mint 4 more (10 total - 5 reserved - 1 already minted)
        contract.mint(
            generator_id=11, 
            entropy=sp.bytes("0x" + os.urandom(16).hex()),
            _sender=charlie,
            _amount=sp.mutez(1000000)
        )
    
    # This should fail because we've reached the public limit
    contract.mint(
        generator_id=11, 
        entropy=sp.bytes("0x" + os.urandom(16).hex()),
        _sender=charlie,
        _amount=sp.mutez(1000000),
        _valid=False,
        _exception="PUBLIC_SOLD_OUT"
    )
    
    # But airdrop should still work
    contract.airdrop(
        generator_id=11,
        recipient=charlie.address,
        entropy=sp.bytes("0x" + os.urandom(16).hex()),
        _sender=alice
    )
    
    # Test airdrop when no reserved editions left
    for i in range(3):  # Use up remaining reserved editions
        contract.airdrop(
            generator_id=11,
            recipient=bob.address,
            entropy=sp.bytes("0x" + os.urandom(16).hex()),
            _sender=alice
        )
    
    contract.airdrop(
        generator_id=11,
        recipient=bob.address,
        entropy=sp.bytes("0x" + os.urandom(16).hex()),
        _sender=alice,
        _valid=False,
        _exception="NO_RESERVED_LEFT"
    )
    
    scenario.h1("NEW FEATURES - Max Per Wallet")
    
    contract.create_generator(
        name=sp.bytes("0x4d6178205065722057616c6c65742054657374"),
        description=sp.bytes("0x54657374696e67206d6178207065722077616c6c6574"),
        code=sp.bytes("0x636f6e736f6c652e6c6f67282254657374"),
        author_bytes=sp.bytes("0x416c696365"),
        reserved_editions=0,
        _sender=alice
    )
    
    contract.set_sale(
        generator_id=12,
        start_time=None,
        price=sp.mutez(500000),
        paused=False,
        editions=10,
        max_per_wallet=sp.Some(2),
        _sender=alice
    )
    
    # First mint should work
    contract.mint(
        generator_id=12, 
        entropy=sp.bytes("0x" + os.urandom(16).hex()),
        _sender=bob,
        _amount=sp.mutez(500000)
    )
    
    # Second mint should work
    contract.mint(
        generator_id=12, 
        entropy=sp.bytes("0x" + os.urandom(16).hex()),
        _sender=bob,
        _amount=sp.mutez(500000)
    )
    
    # Third mint should fail
    contract.mint(
        generator_id=12, 
        entropy=sp.bytes("0x" + os.urandom(16).hex()),
        _sender=bob,
        _amount=sp.mutez(500000),
        _valid=False,
        _exception="EXCEEDS_MAX_PER_WALLET"
    )
    
    # Different wallet should work
    contract.mint(
        generator_id=12, 
        entropy=sp.bytes("0x" + os.urandom(16).hex()),
        _sender=charlie,
        _amount=sp.mutez(500000)
    )
    
    scenario.h1("NEW FEATURES - Generator Versioning and Regeneration")
    
    contract.create_generator(
        name=sp.bytes("0x56657273696f6e696e672054657374"),
        description=sp.bytes("0x54657374696e672067656e657261746f722076657273696f6e696e67"),
        code=sp.bytes("0x636f6e736f6c652e6c6f67282256657273696f6e203122"),
        author_bytes=sp.bytes("0x416c696365"),
        reserved_editions=0,
        _sender=alice
    )
    
    contract.set_sale(
        generator_id=13,
        start_time=None,
        price=sp.mutez(100000),
        paused=False,
        editions=5,
        max_per_wallet=None,
        _sender=alice
    )
    
    # Mint a token
    contract.mint(
        generator_id=13, 
        entropy=sp.bytes("0x" + os.urandom(16).hex()),
        _sender=bob,
        _amount=sp.mutez(100000)
    )
    
    token_id = contract.data.next_token_id - 1
    initial_version = contract.data.generators[13].version
    scenario.verify(initial_version == 1)
    
    # Update generator (should increment version)
    contract.update_generator(
        generator_id=13,
        name=sp.bytes("0x56657273696f6e696e672054657374205632"),
        description=sp.bytes("0x557064617465642067656e657261746f72"),
        code=sp.bytes("0x636f6e736f6c652e6c6f67282256657273696f6e203222"),
        author_bytes=sp.bytes("0x416c696365"),
        reserved_editions=0,
        _sender=alice
    )
    
    scenario.verify(contract.data.generators[13].version == 2)
    
    # Test regenerate_token
    contract.regenerate_token(token_id, _sender=bob)
    scenario.verify(contract.data.token_extra[token_id].generator_version == 2)
    
    # Test regenerate_token with wrong owner
    contract.regenerate_token(
        token_id,
        _sender=alice,
        _valid=False,
        _exception="ONLY_OWNER"
    )
    
    # Test regenerate_token when no update is possible
    contract.regenerate_token(
        token_id,
        _sender=bob,
        _valid=False,
        _exception="NO_UPDATE_POSSIBLE"
    )
    
    scenario.h1("NEW FEATURES - Generator Flagging")
    
    # Re-add moderator for flagging tests
    contract.add_moderator(moderator.address, _sender=new_admin)
    
    contract.flag_generator(generator_id=0, flag=1, _sender=moderator)
    scenario.verify(contract.data.generators[0].flag == 1)
    
    contract.flag_generator(generator_id=0, flag=2, _sender=new_admin)
    scenario.verify(contract.data.generators[0].flag == 2)
    
    contract.flag_generator(
        generator_id=0,
        flag=3,
        _sender=alice,
        _valid=False,
        _exception="ONLY_MODS"
    )
    
    scenario.h1("NEW FEATURES - Thumbnail Updates")
    
    # Create a token to test thumbnail updates
    contract.create_generator(
        name=sp.bytes("0x5468756d626e61696c2054657374"),
        description=sp.bytes("0x54657374696e67207468756d626e61696c20757064617465"),
        code=sp.bytes("0x636f6e736f6c652e6c6f67282254657374"),
        author_bytes=sp.bytes("0x416c696365"),
        reserved_editions=0,
        _sender=alice
    )
    
    contract.set_sale(
        generator_id=14,
        start_time=None,
        price=sp.mutez(0),
        paused=False,
        editions=1,
        max_per_wallet=None,
        _sender=alice
    )
    
    contract.mint(
        generator_id=14, 
        entropy=sp.bytes("0x" + os.urandom(16).hex()),
        _sender=alice,
        _amount=sp.mutez(0)
    )
    
    thumbnail_token_id = contract.data.next_token_id - 1
    new_thumbnail = sp.bytes("0x68747470733a2f2f6e65772d7468756d626e61696c2e636f6d")
    
    # Author can update thumbnail
    contract.update_thumbnail(
        token_id=thumbnail_token_id,
        thumbnailUri=new_thumbnail,
        _sender=alice
    )
    
    # Moderator can update thumbnail
    contract.update_thumbnail(
        token_id=thumbnail_token_id,
        thumbnailUri=sp.bytes("0x68747470733a2f2f6d6f642d7468756d626e61696c2e636f6d"),
        _sender=moderator
    )
    
    # Admin can update thumbnail
    contract.update_thumbnail(
        token_id=thumbnail_token_id,
        thumbnailUri=sp.bytes("0x68747470733a2f2f61646d696e2d7468756d626e61696c2e636f6d"),
        _sender=new_admin
    )
    
    # Non-author/non-mod cannot update thumbnail
    contract.update_thumbnail(
        token_id=thumbnail_token_id,
        thumbnailUri=new_thumbnail,
        _sender=bob,
        _valid=False,
        _exception="ONLY_AUTHOR_OR_MODS"
    )
    
    scenario.h1("NEW FEATURES - Byte Limit Configuration")
    
    # Test setting byte limits (moderator/admin only)
    contract.set_max_bytes_name(200, _sender=moderator)
    scenario.verify(contract.data.max_bytes_name == 200)
    
    contract.set_max_bytes_desc(10000, _sender=new_admin)
    scenario.verify(contract.data.max_bytes_desc == 10000)
    
    contract.set_max_bytes_code(40000, _sender=moderator)
    scenario.verify(contract.data.max_bytes_code == 40000)
    
    contract.set_max_bytes_author(50, _sender=new_admin)
    scenario.verify(contract.data.max_bytes_author == 50)
    
    # Test non-mod cannot set limits
    contract.set_max_bytes_name(
        300,
        _sender=alice,
        _valid=False,
        _exception="ONLY_MODS"
    )
    
    # Test author bytes too long with new limit
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
    
    scenario.h1("NEW FEATURES - Reserved Editions in Updates")
    
    contract.create_generator(
        name=sp.bytes("0x526573657276652055706461746520546573742020"),
        description=sp.bytes("0x54657374696e6720726573657276656420656469746f6e7320696e20757064617465"),
        code=sp.bytes("0x636f6e736f6c652e6c6f67282254657374"),
        author_bytes=sp.bytes("0x416c696365"),
        reserved_editions=2,
        _sender=alice
    )
    
    contract.set_sale(
        generator_id=15,
        start_time=None,
        price=sp.mutez(100000),
        paused=False,
        editions=10,
        max_per_wallet=None,
        _sender=alice
    )
    
    # Test updating reserved editions within capacity
    contract.update_generator(
        generator_id=15,
        name=sp.bytes("0x526573657276652055706461746520546573742020"),
        description=sp.bytes("0x54657374696e6720726573657276656420656469746f6e7320696e20757064617465"),
        code=sp.bytes("0x636f6e736f6c652e6c6f67282254657374"),
        author_bytes=sp.bytes("0x416c696365"),
        reserved_editions=5,
        _sender=alice
    )
    
    # Test updating reserved editions beyond capacity
    contract.update_generator(
        generator_id=15,
        name=sp.bytes("0x526573657276652055706461746520546573742020"),
        description=sp.bytes("0x54657374696e6720726573657276656420656469746f6e7320696e20757064617465"),
        code=sp.bytes("0x636f6e736f6c652e6c6f67282254657374"),
        author_bytes=sp.bytes("0x416c696365"),
        reserved_editions=15,
        _sender=alice,
        _valid=False,
        _exception="RESERVE_EXCEEDS_CAPACITY"
    )
    
    scenario.h1("EDGE CASES - Zero Editions")
    
    contract.create_generator(
        name=sp.bytes("0x5a65726f20456469746f6e732054657374"),
        description=sp.bytes("0x54657374696e67207a65726f20656469746f6e73"),
        code=sp.bytes("0x636f6e736f6c652e6c6f67282254657374"),
        author_bytes=sp.bytes("0x416c696365"),
        reserved_editions=0,
        _sender=alice
    )
    
    contract.set_sale(
        generator_id=16,
        start_time=None,
        price=sp.mutez(100000),
        paused=False,
        editions=0,
        max_per_wallet=None,
        _sender=alice
    )
    
    contract.mint(
        generator_id=16, 
        entropy=sp.bytes("0x" + os.urandom(16).hex()),
        _sender=bob,
        _amount=sp.mutez(100000),
        _valid=False,
        _exception="PUBLIC_SOLD_OUT"
    )
    
    scenario.h1("EDGE CASES - Large Numbers")
    
    contract.create_generator(
        name=sp.bytes("0x4c61726765204e756d6265722054657374"),
        description=sp.bytes("0x54657374696e67206c61726765206e756d62657273"),
        code=sp.bytes("0x636f6e736f6c652e6c6f67282254657374"),
        author_bytes=sp.bytes("0x416c696365"),
        reserved_editions=999999,
        _sender=alice
    )
    
    contract.set_sale(
        generator_id=17,
        start_time=None,
        price=sp.mutez(0),
        paused=False,
        editions=1000000,
        max_per_wallet=sp.Some(999999),
        _sender=alice
    )
    
    scenario.h1("EDGE CASES - Empty Bytes")
    
    contract.create_generator(
        name=sp.bytes("0x"),
        description=sp.bytes("0x"),
        code=sp.bytes("0x"),
        author_bytes=sp.bytes("0x"),
        reserved_editions=0,
        _sender=alice
    )
    
    scenario.verify(contract.data.generators[18].name == sp.bytes("0x"))
    scenario.verify(contract.data.generators[18].description == sp.bytes("0x"))
    scenario.verify(contract.data.generators[18].code == sp.bytes("0x"))
    scenario.verify(contract.data.generators[18].author_bytes == sp.bytes("0x"))
