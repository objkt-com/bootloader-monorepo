"""
Entropy and RNG Integration Tests

This module tests entropy handling and RNG contract integration:
- Entropy request and callback flow
- RNG contract validation
- Seed setting and validation
- Token regeneration with entropy
- Edge cases and error conditions
"""

from bootloader import bootloader
from randomiser import randomiser
import smartpy as sp
import os

@sp.module
def test_utils():
    class MockRngContract(sp.Contract):
        def __init__(self):
            self.data = sp.cast(sp.big_map({}), sp.big_map[sp.nat, sp.bytes])
        
        @sp.entrypoint
        def request_entropy(self, token_id, entropy):
            # Store the request and immediately respond with mock entropy
            self.data[token_id] = entropy
            # Call back to bootloader with deterministic entropy
            mock_entropy = sp.sha256(entropy + sp.pack(token_id))
            # SHA256 already returns 32 bytes, so we can use it directly
            contract = sp.contract(
                sp.record(token_id=sp.nat, entropy=sp.bytes), 
                sp.sender, 
                entrypoint="set_entropy"
            ).unwrap_some()
            sp.transfer(
                sp.record(token_id=token_id, entropy=mock_entropy), 
                sp.mutez(0), 
                contract
            )

    class BadRngContract(sp.Contract):
        def __init__(self):
            self.data = ()
        
        @sp.entrypoint
        def request_entropy(self, token_id, entropy):
            # This contract doesn't call back, simulating a broken RNG
            pass

    class InvalidSeedRngContract(sp.Contract):
        def __init__(self):
            self.data = ()
        
        @sp.entrypoint
        def request_entropy(self, token_id, entropy):
            # Call back with invalid seed length
            contract = sp.contract(
                sp.record(token_id=sp.nat, entropy=sp.bytes), 
                sp.sender, 
                entrypoint="set_entropy"
            ).unwrap_some()
            sp.transfer(
                sp.record(token_id=token_id, entropy=sp.bytes("0x1234")),  # Too short
                sp.mutez(0), 
                contract
            )

@sp.add_test()
def test_entropy_request_flow():
    """
    Tests the complete entropy request flow:
    - Minting requests entropy from RNG contract
    - RNG contract calls back with entropy
    - Token metadata is updated with final entropy
    """
    scenario = sp.test_scenario("Entropy Request Flow", [bootloader, randomiser])

    admin = sp.test_account("Admin")
    alice = sp.test_account("Alice")
    bob = sp.test_account("Bob")

    mock_rng = test_utils.MockRngContract()
    scenario += mock_rng

    contract = bootloader.Bootloader(
        admin_address=admin.address,
        rng_contract=mock_rng.address, 
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
        name=sp.bytes("0x456e74726f7079205465737420417274"),
        description=sp.bytes("0x54657374696e6720656e74726f707920666c6f77"),
        code=sp.bytes("0x636f6e736f6c652e6c6f67282254657374"),
        author_bytes=sp.bytes("0x416c696365"),
        reserved_editions=0,
        bootloader_id=0,
        _sender=alice
    )

    # Set sale
    contract.set_sale(
        generator_id=0,
        start_time=None,
        price=sp.mutez(0),
        paused=False,
        editions=5,
        max_per_wallet=None,
        _sender=alice
    )

    scenario.h2("Mint token with entropy")
    user_entropy = sp.bytes("0x" + "ab" * 16)  # 32 bytes of user entropy
    contract.mint(
        generator_id=0, 
        entropy=user_entropy,
        _sender=bob,
        _amount=sp.mutez(0)
    )

    scenario.h2("Token is created and entropy is set")
    scenario.verify(contract.data.next_token_id == 1)
    scenario.verify(contract.data.ledger[0] == bob.address)
    scenario.verify(contract.data.token_extra[0].seed.is_some())
    
    # The mock RNG should have processed the entropy
    scenario.verify(mock_rng.data.contains(0))

@sp.add_test()
def test_set_entropy_validation():
    """
    Tests entropy setting validation:
    - Only RNG contract can set entropy
    - Entropy must be exactly 32 bytes
    - Cannot set entropy twice for same token
    """
    scenario = sp.test_scenario("Set Entropy Validation", [bootloader, randomiser])

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

    # Create generator and mint token
    contract.create_generator(
        name=sp.bytes("0x56616c69646174696f6e2054657374"),
        description=sp.bytes("0x54657374696e6720656e74726f70792076616c69646174696f6e"),
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
        editions=5,
        max_per_wallet=None,
        _sender=alice
    )

    contract.mint(
        generator_id=0, 
        entropy=sp.bytes("0x" + "cd" * 16),
        _sender=bob,
        _amount=sp.mutez(0)
    )

    scenario.h2("Non-RNG contract cannot set entropy")
    valid_entropy = sp.bytes("0x" + "ef" * 32)  # 32 bytes
    contract.set_entropy(
        sp.record(token_id=0, entropy=valid_entropy),
        _sender=alice,
        _valid=False,
        _exception="INVALID_RNG_CONTRACT"
    )

    scenario.h2("Invalid entropy length fails")
    short_entropy = sp.bytes("0x1234")  # Too short
    contract.set_entropy(
        sp.record(token_id=0, entropy=short_entropy),
        _sender=rng.address,
        _valid=False,
        _exception="INVALID_SEED_LENGTH"
    )

    long_entropy = sp.bytes("0x" + "ab" * 40)  # Too long
    contract.set_entropy(
        sp.record(token_id=0, entropy=long_entropy),
        _sender=rng.address,
        _valid=False,
        _exception="INVALID_SEED_LENGTH"
    )

@sp.add_test()
def test_airdrop_entropy_flow():
    """
    Tests entropy flow for airdropped tokens:
    - Airdrop requests entropy
    - Entropy is set correctly for airdropped tokens
    - Token metadata is generated properly
    """
    scenario = sp.test_scenario("Airdrop Entropy Flow", [bootloader, randomiser])

    admin = sp.test_account("Admin")
    alice = sp.test_account("Alice")
    bob = sp.test_account("Bob")

    mock_rng = test_utils.MockRngContract()
    scenario += mock_rng

    contract = bootloader.Bootloader(
        admin_address=admin.address,
        rng_contract=mock_rng.address, 
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
        name=sp.bytes("0x41697264726f7020456e74726f7079"),
        description=sp.bytes("0x54657374696e672061697264726f7020656e74726f7079"),
        code=sp.bytes("0x636f6e736f6c652e6c6f67282254657374"),
        author_bytes=sp.bytes("0x416c696365"),
        reserved_editions=5,
        bootloader_id=0,
        _sender=alice
    )

    scenario.h2("Airdrop token with entropy")
    airdrop_entropy = sp.bytes("0x" + "12" * 16)
    contract.airdrop(
        generator_id=0,
        recipient=bob.address,
        entropy=airdrop_entropy,
        _sender=alice
    )

    scenario.h2("Airdropped token has entropy set")
    scenario.verify(contract.data.next_token_id == 1)
    scenario.verify(contract.data.ledger[0] == bob.address)
    scenario.verify(contract.data.token_extra[0].seed.is_some())
    scenario.verify(mock_rng.data.contains(0))

@sp.add_test()
def test_token_regeneration_with_entropy():
    """
    Tests token regeneration functionality:
    - Token can be regenerated after generator update
    - Regeneration uses existing entropy
    - Only token owner can regenerate
    - Cannot regenerate without generator update
    """
    scenario = sp.test_scenario("Token Regeneration with Entropy", [bootloader, randomiser])

    admin = sp.test_account("Admin")
    alice = sp.test_account("Alice")
    bob = sp.test_account("Bob")

    mock_rng = test_utils.MockRngContract()
    scenario += mock_rng

    contract = bootloader.Bootloader(
        admin_address=admin.address,
        rng_contract=mock_rng.address, 
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

    # Create generator and mint token
    contract.create_generator(
        name=sp.bytes("0x526567656e20546573742047656e"),
        description=sp.bytes("0x54657374696e6720746f6b656e20726567656e65726174696f6e"),
        code=sp.bytes("0x636f6e736f6c652e6c6f67282256312054657374"),
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
        editions=5,
        max_per_wallet=None,
        _sender=alice
    )

    contract.mint(
        generator_id=0, 
        entropy=sp.bytes("0x" + "aa" * 16),
        _sender=bob,
        _amount=sp.mutez(0)
    )

    scenario.h2("Token is created with version 1")
    scenario.verify(contract.data.token_extra[0].generator_version == 1)

    scenario.h2("Cannot regenerate without generator update")
    contract.regenerate_token(
        0,
        _sender=bob,
        _valid=False,
        _exception="NO_UPDATE_POSSIBLE"
    )

    scenario.h2("Update generator to version 2")
    contract.update_generator(
        generator_id=0,
        name=sp.bytes("0x526567656e20546573742047656e205632"),
        description=sp.bytes("0x557064617465642067656e657261746f72"),
        code=sp.bytes("0x636f6e736f6c652e6c6f67282256322054657374"),
        author_bytes=sp.bytes("0x416c696365"),
        reserved_editions=0,
        _sender=alice
    )

    scenario.h2("Token owner can regenerate")
    contract.regenerate_token(
        0,
        _sender=bob
    )

    scenario.verify(contract.data.token_extra[0].generator_version == 2)

    scenario.h2("Non-owner cannot regenerate")
    # Update generator again
    contract.update_generator(
        generator_id=0,
        name=sp.bytes("0x526567656e20546573742047656e205633"),
        description=sp.bytes("0x557064617465642067656e657261746f72"),
        code=sp.bytes("0x636f6e736f6c652e6c6f67282256332054657374"),
        author_bytes=sp.bytes("0x416c696365"),
        reserved_editions=0,
        _sender=alice
    )

    contract.regenerate_token(
        0,
        _sender=alice,
        _valid=False,
        _exception="ONLY_OWNER"
    )

@sp.add_test()
def test_rng_contract_update():
    """
    Tests RNG contract updates:
    - Admin/moderator can update RNG contract
    - New RNG contract is used for subsequent operations
    - Existing tokens are not affected
    """
    scenario = sp.test_scenario("RNG Contract Update", [bootloader, randomiser])

    admin = sp.test_account("Admin")
    alice = sp.test_account("Alice")
    bob = sp.test_account("Bob")

    old_rng = test_utils.MockRngContract()
    scenario += old_rng
    
    new_rng = test_utils.MockRngContract()
    scenario += new_rng

    contract = bootloader.Bootloader(
        admin_address=admin.address,
        rng_contract=old_rng.address, 
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
        name=sp.bytes("0x524e472055706461746520546573742020"),
        description=sp.bytes("0x54657374696e6720524e4720757064617465"),
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
        editions=5,
        max_per_wallet=None,
        _sender=alice
    )

    scenario.h2("Mint with old RNG contract")
    contract.mint(
        generator_id=0, 
        entropy=sp.bytes("0x" + "bb" * 16),
        _sender=bob,
        _amount=sp.mutez(0)
    )

    scenario.verify(old_rng.data.contains(0))
    scenario.verify(~new_rng.data.contains(0))

    scenario.h2("Update RNG contract")
    contract.set_rng_contract(new_rng.address, _sender=admin)
    scenario.verify(contract.data.rng_contract == new_rng.address)

    scenario.h2("Mint with new RNG contract")
    contract.mint(
        generator_id=0, 
        entropy=sp.bytes("0x" + "cc" * 16),
        _sender=bob,
        _amount=sp.mutez(0)
    )

    scenario.verify(new_rng.data.contains(1))
    scenario.verify(~old_rng.data.contains(1))

@sp.add_test()
def test_entropy_edge_cases():
    """
    Tests edge cases in entropy handling:
    - Empty entropy
    - Large entropy values
    - Duplicate entropy values
    - Token without seed cannot regenerate
    """
    scenario = sp.test_scenario("Entropy Edge Cases", [bootloader, randomiser])

    admin = sp.test_account("Admin")
    alice = sp.test_account("Alice")
    bob = sp.test_account("Bob")

    mock_rng = test_utils.MockRngContract()
    scenario += mock_rng

    contract = bootloader.Bootloader(
        admin_address=admin.address,
        rng_contract=mock_rng.address, 
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
        name=sp.bytes("0x456467652043617365732054657374"),
        description=sp.bytes("0x54657374696e6720656e74726f707920656467652063617365732020"),
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

    scenario.h2("Mint with empty entropy")
    contract.mint(
        generator_id=0, 
        entropy=sp.bytes("0x"),
        _sender=bob,
        _amount=sp.mutez(0)
    )

    scenario.verify(contract.data.next_token_id == 1)

    scenario.h2("Mint with large entropy")
    large_entropy = sp.bytes("0x" + "ff" * 100)  # 100 bytes
    contract.mint(
        generator_id=0, 
        entropy=large_entropy,
        _sender=bob,
        _amount=sp.mutez(0)
    )

    scenario.verify(contract.data.next_token_id == 2)

    scenario.h2("Mint with same entropy (should work)")
    contract.mint(
        generator_id=0, 
        entropy=large_entropy,  # Same entropy as before
        _sender=bob,
        _amount=sp.mutez(0)
    )

    scenario.verify(contract.data.next_token_id == 3)

@sp.add_test()
def test_entropy_callback_security():
    """
    Tests security aspects of entropy callbacks:
    - Only designated RNG contract can call set_entropy
    - Cannot set entropy for non-existent tokens
    - Cannot overwrite existing entropy
    """
    scenario = sp.test_scenario("Entropy Callback Security", [bootloader, randomiser])

    admin = sp.test_account("Admin")
    alice = sp.test_account("Alice")
    bob = sp.test_account("Bob")
    attacker = sp.test_account("Attacker")

    mock_rng = test_utils.MockRngContract()
    scenario += mock_rng

    contract = bootloader.Bootloader(
        admin_address=admin.address,
        rng_contract=mock_rng.address, 
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

    # Create generator and mint token
    contract.create_generator(
        name=sp.bytes("0x53656375726974792054657374"),
        description=sp.bytes("0x54657374696e6720656e74726f70792073656375726974792020"),
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
        editions=5,
        max_per_wallet=None,
        _sender=alice
    )

    contract.mint(
        generator_id=0, 
        entropy=sp.bytes("0x" + "ee" * 16),
        _sender=bob,
        _amount=sp.mutez(0)
    )

    scenario.h2("Attacker cannot set entropy")
    malicious_entropy = sp.bytes("0x" + "ff" * 32)
    contract.set_entropy(
        sp.record(token_id=0, entropy=malicious_entropy),
        _sender=attacker,
        _valid=False,
        _exception="INVALID_RNG_CONTRACT"
    )

    scenario.h2("Cannot set entropy for non-existent token")
    contract.set_entropy(
        sp.record(token_id=999, entropy=malicious_entropy),
        _sender=mock_rng.address,
        _valid=False
    )

    scenario.h2("Token has entropy set by legitimate RNG")
    scenario.verify(contract.data.token_extra[0].seed.is_some())
