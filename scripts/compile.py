import smartpy as sp

from contracts.bootloaders.generic_web import generic_web
from contracts.bootloaders.svg_js import svg_js
from contracts.randomiser import randomiser


@sp.add_test()
def test():
    scenario = sp.test_scenario(".smartpy/build/svg_js")
    admin = sp.test_account("admin")
    contract = svg_js.Bootloader(admin.address, admin.address, sp.big_map({}), {}, [])
    scenario += contract


@sp.add_test()
def test():
    scenario = sp.test_scenario(".smartpy/build/generic_web")
    contract = generic_web.Bootloader()
    scenario += contract


@sp.add_test()
def test():
    scenario = sp.test_scenario(".smartpy/build/lambda_0_0_1")
    scenario += svg_js.LambdaHelper(svg_js.v0_0_1)


@sp.add_test()
def test():
    scenario = sp.test_scenario(".smartpy/build/lambda_0_0_1_shadownet")
    scenario += svg_js.LambdaHelper(svg_js.v0_0_1_shadownet)


@sp.add_test()
def test_randomiser():
    # Test scenario
    scenario = sp.test_scenario(".smartpy/build/randomiser", randomiser)
    scenario += randomiser.CentralisedRandomiser()
