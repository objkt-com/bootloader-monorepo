import smartpy as sp
from smartpy.templates import fa2_lib as fa2
from utils import bytes_utils

# Main template for FA2 contracts
main = fa2.main


@sp.module
def my_module():
    import main
    import bytes_utils

    # Order of inheritance: [Admin], [<policy>], <base class>, [<other mixins>].
    class SVGNFT(
        main.Admin,
        main.Nft,
        main.MintNft,
        main.BurnNft,
        main.OnchainviewBalanceOf,
    ):
        def __init__(self, admin_address, contract_metadata, ledger, token_metadata):
            """Initializes the contract with administrative permissions and NFT functionalities.
            The base class is required; all mixins are optional.
            The initialization must follow this order:

            - Other mixins such as OnchainviewBalanceOf, MintNFT, and BurnNFT
            - Base class: NFT
            - Transfer policy
            - Admin
            """

            # Initialize on-chain balance view
            main.OnchainviewBalanceOf.__init__(self)

            # Initialize the NFT-specific entrypoints
            main.BurnNft.__init__(self)
            main.MintNft.__init__(self)

            # Initialize the NFT base class
            main.Nft.__init__(self, contract_metadata, ledger, token_metadata)

            # Initialize administrative permissions
            main.Admin.__init__(self, admin_address)
            self.data.next_token_id = 0
            self.data.frags = sp.cast(sp.big_map({}), sp.big_map[sp.nat, sp.bytes])
        
        @sp.entrypoint
        def add_fragment(self, frag_id: sp.nat, frag: sp.bytes):
            assert self.data.administrator == sp.sender
            self.data.frags[frag_id] = frag
        
        @sp.private(with_storage="read-only")
        def draw_circle(self, x, y, r):
            res = self.data.frags[1]
            res += bytes_utils.from_int(r)
            res += self.data.frags[2]
            res += bytes_utils.from_int(x)
            res += self.data.frags[3]
            res += bytes_utils.from_int(y)
            res += self.data.frags[4]
            return res

        @sp.private
        def log_2(self, n):
            j = 1
            c = 0
            while j < n:
                j *= 2
                c += 1
            return c

        @sp.private(with_storage="read-only")
        def rand(self, entropy: sp.bytes, n: sp.nat):
            entropy_index = 0
            return 5
            # result = 0
            # drawn = False
            # bit_masks = [
            #     sp.bytes("0x01"),
            #     sp.bytes("0x02"),
            #     sp.bytes("0x04"),
            #     sp.bytes("0x08"),
            #     sp.bytes("0x10"),
            #     sp.bytes("0x20"),
            #     sp.bytes("0x40"),
            #     sp.bytes("0x80"),
            # ]
            # # edge-case: n ≤ 1 ⇒ always return 0
            # if n > 1:
            #     bits_needed = 4#self.log_2(n-1)

            #     # accumulators for the candidate number
            #     num            = 0
            #     bits_collected = 0

            #     while not drawn:
            #         # get the next byte → 8 booleans
            #         byte = sp.slice(entropy_index, 1, entropy).unwrap_some()


            #         for bit_mask in bit_masks:
            #             if not drawn:
            #                 if sp.and_bytes(byte, bit_mask) == sp.bytes("0x00"):
            #                     num += 1
            #                 bits_collected += 1

            #                 if bits_collected == bits_needed:
            #                     if num < n:
            #                         result = num
            #                         drawn = True
            #                     else:
            #                         num = 0
            #                         bits_collected = 0
            # return result
        @sp.private
        def multiply(self, a: sp.nat, b: sp.nat):
            return a * b 

        @sp.entrypoint
        def mint_test(self, entropy: sp.bytes): 
            # Construct the artifactUri as a svg that is rendered on-chain
            # create a simple util in python to convert svg primitives into a
            # base64 buildable data uri. Start with something simple like circles
            # and squares of different sizes that are assembled on-chain

            svg_string = self.data.frags[0] # datauri + svg

            # for i in range(5):
            entropy = sp.sha256(entropy)
            self.multiply(4, 6)
            # x = self.multiply(5, 3)
            # x = 20 + self.rand(entropy, 60)
            #     entropy = sp.sha256(entropy)
            #     y = 20 + self.draw(entropy, 60)
            #     entropy = sp.sha256(entropy)
            #     r = self.draw(entropy)
            #     svg_string += self.draw_circle(x, y, r)

            svg_string += self.data.frags[5]


            self.data.ledger[self.data.next_token_id] = sp.sender
            self.data.token_metadata[self.data.next_token_id] = sp.record(
                token_id=self.data.next_token_id,
                token_info={
                    "name": sp.bytes("0x1234"),
                    "artifactUri": svg_string,
                }
            )
            self.data.next_token_id += 1

@sp.add_test()
def test():
    # Create and configure the test scenario
    # Import the types from the FA2 library, the library itself, and the contract module, in that order.
    scenario = sp.test_scenario("svg_nft")

    # Define test accounts
    admin = sp.test_account("Admin")
    alice = sp.test_account("Alice")
    bob = sp.test_account("Bob")
    start = 'data:content/type,<svg xmlns="http://www.w3.org/2000/svg" version="1.1" width="120" height="120">'
    end = '/<svg>'

    # Instantiate the FA2 NFT contract
    contract = my_module.SVGNFT(
        admin.address, sp.big_map(), {}, []
    )

    scenario += contract