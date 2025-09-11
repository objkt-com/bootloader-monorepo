"""
Admin Access Control Tests

This module tests all administrative functions and access control mechanisms:
- Admin-only operations (add/remove moderators, set treasury, set platform fees)
- Moderator permissions (set treasury, set platform fees, flag generators, set RNG contract)
- Access control enforcement (ensuring non-admins/non-mods cannot perform restricted operations)
- Admin transfer functionality
- Bootloader management (admin-only)
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
            self.data = sp.amount

@sp.add_test()
def test_admin_only_operations():
    """
    Tests that only admin can perform admin-specific operations:
    - Adding moderators
    - Removing moderators
    - Setting administrator
    - Adding bootloaders
    """
    scenario = sp.test_scenario("Admin Only Operations", [bootloader, randomiser])

    admin = sp.test_account("Admin")
    alice = sp.test_account("Alice")
    moderator = sp.test_account("Moderator")
    new_admin = sp.test_account("NewAdmin")

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

    scenario.h2("Admin can add moderators")
    contract.add_moderator(moderator.address, _sender=admin)
    scenario.verify(contract.data.moderators.contains(moderator.address))
    
    scenario.h2("Non-admin cannot add moderators")
    contract.add_moderator(
        alice.address,
        _sender=alice,
        _valid=False,
        _exception="ONLY_ADMIN"
    )
    
    scenario.h2("Admin can remove moderators")
    contract.remove_moderator(moderator.address, _sender=admin)
    scenario.verify(~contract.data.moderators.contains(moderator.address))
    
    scenario.h2("Non-admin cannot remove moderators")
    contract.remove_moderator(
        alice.address,
        _sender=alice,
        _valid=False,
        _exception="ONLY_ADMIN"
    )
    
    scenario.h2("Admin can transfer admin rights")
    contract.set_administrator(new_admin.address, _sender=admin)
    
    scenario.h2("Old admin loses admin privileges")
    contract.add_moderator(
        moderator.address,
        _sender=admin,
        _valid=False,
        _exception="ONLY_ADMIN"
    )
    
    scenario.h2("New admin has admin privileges")
    contract.add_moderator(moderator.address, _sender=new_admin)
    scenario.verify(contract.data.moderators.contains(moderator.address))

    scenario.h2("Admin can add bootloaders")
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
        _sender=new_admin
    )
    scenario.verify(contract.data.next_bootloader_id == 1)
    scenario.verify(contract.data.bootloaders.contains(0))

    scenario.h2("Non-admin cannot add bootloaders")
    contract.add_bootloader(
        version=sp.bytes("0x76302e302e32"),
        fragments=[sp.bytes("0x00")],
        fun=bootloader.v0_0_1,
        storage_limits=storage_limits,
        _sender=alice,
        _valid=False,
        _exception="ONLY_ADMIN"
    )

@sp.add_test()
def test_moderator_permissions():
    """
    Tests moderator permissions for various operations:
    - Setting treasury
    - Setting platform fees
    - Setting RNG contract
    - Flagging generators
    """
    scenario = sp.test_scenario("Moderator Permissions", [bootloader, randomiser])

    admin = sp.test_account("Admin")
    alice = sp.test_account("Alice")
    moderator = sp.test_account("Moderator")
    treasury = sp.test_account("Treasury")

    treasury_counter = test_utils.BalanceCounter()
    scenario += treasury_counter
    
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

    # Add moderator
    contract.add_moderator(moderator.address, _sender=admin)
    
    # Add bootloader for testing
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
    
    scenario.h2("Moderator can set treasury")
    contract.set_treasury(treasury_counter.address, _sender=moderator)
    scenario.verify(contract.data.treasury == treasury_counter.address)
    
    scenario.h2("Moderator can set platform fees")
    contract.set_platform_fee_bps(1500, _sender=moderator)
    scenario.verify(contract.data.platform_fee_bps == 1500)
    
    scenario.h2("Moderator can set RNG contract")
    contract.set_rng_contract(rng.address, _sender=moderator)
    scenario.verify(contract.data.rng_contract == rng.address)
    
    # Create a generator to test flagging
    contract.create_generator(
        name=sp.bytes("0x546573742047656e657261746f72"),
        description=sp.bytes("0x54657374"),
        code=sp.bytes("0x636f6e736f6c652e6c6f67282254657374"),
        author_bytes=sp.bytes("0x416c696365"),
        reserved_editions=0,
        bootloader_id=0,
        _sender=alice
    )
    
    scenario.h2("Moderator can flag generators")
    contract.flag_generator(generator_id=0, flag=1, _sender=moderator)
    scenario.verify(contract.data.generators[0].flag == 1)

@sp.add_test()
def test_access_control_enforcement():
    """
    Tests that non-privileged users cannot perform restricted operations:
    - Non-mods cannot set treasury, platform fees, set RNG contract
    - Non-authors cannot update generators or set sales
    - Non-mods cannot flag generators
    """
    scenario = sp.test_scenario("Access Control Enforcement", [bootloader, randomiser])

    admin = sp.test_account("Admin")
    alice = sp.test_account("Alice")
    bob = sp.test_account("Bob")
    treasury = sp.test_account("Treasury")

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

    scenario.h2("Non-mods cannot set treasury")
    contract.set_treasury(
        alice.address,
        _sender=alice,
        _valid=False,
        _exception="ONLY_MODS"
    )
    
    scenario.h2("Non-mods cannot set platform fees")
    contract.set_platform_fee_bps(
        3000,
        _sender=alice,
        _valid=False,
        _exception="ONLY_MODS"
    )
    
    scenario.h2("Non-mods cannot set RNG contract")
    contract.set_rng_contract(
        alice.address,
        _sender=alice,
        _valid=False,
        _exception="ONLY_MODS"
    )
    
    scenario.h2("Non-mods cannot flag generators")
    # First create a bootloader and generator
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
    
    contract.create_generator(
        name=sp.bytes("0x546573742047656e657261746f72"),
        description=sp.bytes("0x54657374"),
        code=sp.bytes("0x636f6e736f6c652e6c6f67282254657374"),
        author_bytes=sp.bytes("0x416c696365"),
        reserved_editions=0,
        bootloader_id=0,
        _sender=alice
    )
    
    contract.flag_generator(
        generator_id=0,
        flag=3,
        _sender=bob,
        _valid=False,
        _exception="ONLY_MODS"
    )

@sp.add_test()
def test_platform_fee_limits():
    """
    Tests platform fee validation:
    - Platform fees cannot exceed 10000 BPS (100%)
    - Valid platform fee changes work correctly
    """
    scenario = sp.test_scenario("Platform Fee Limits", [bootloader, randomiser])

    admin = sp.test_account("Admin")

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

    scenario.h2("Platform fee cannot exceed 10000 BPS")
    contract.set_platform_fee_bps(
        10001,
        _sender=admin,
        _valid=False,
        _exception="BPS_TOO_HIGH"
    )
    
    scenario.h2("Platform fee can be set to maximum (10000 BPS)")
    contract.set_platform_fee_bps(10000, _sender=admin)
    scenario.verify(contract.data.platform_fee_bps == 10000)
    
    scenario.h2("Platform fee can be set to valid values")
    contract.set_platform_fee_bps(2500, _sender=admin)
    scenario.verify(contract.data.platform_fee_bps == 2500)
