import smartpy as sp

from contracts.bootloader import bootloader
from contracts.randomiser import randomiser

@sp.add_test()
def test():
    scenario = sp.test_scenario("bootloader")
    admin = sp.test_account("admin")
    contract = bootloader.Bootloader(
        admin.address, admin.address, sp.big_map({}), {}, []
    )
    scenario += contract

@sp.add_test()
def test():
    scenario = sp.test_scenario("lambda_0_0_1")
    scenario += bootloader.LambdaHelper(bootloader.v0_0_1)

@sp.add_test()
def test():
    scenario = sp.test_scenario("lambda_0_0_1_ghostnet")
    scenario += bootloader.LambdaHelper(bootloader.v0_0_1_ghostnet)



@sp.add_test()
def test_randomiser():
    # Test scenario
    scenario = sp.test_scenario("randomiser", randomiser)
    scenario += randomiser.CentralisedRandomiser()