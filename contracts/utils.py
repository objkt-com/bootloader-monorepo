import smartpy as sp

@sp.module
def bytes_utils():
    # Map a single digit (0..9) to its ASCII byte
    def _digit_to_byte(d):
        table = {
            0: sp.bytes("0x30"),
            1: sp.bytes("0x31"),
            2: sp.bytes("0x32"),
            3: sp.bytes("0x33"),
            4: sp.bytes("0x34"),
            5: sp.bytes("0x35"),
            6: sp.bytes("0x36"),
            7: sp.bytes("0x37"),
            8: sp.bytes("0x38"),
            9: sp.bytes("0x39"),
        }
        sp.cast(d, sp.int)
        assert d >= 0 and d < 10
        return table[d]

    def from_int(n):
        """Convert an integer to ASCII-encoded decimal bytes.

        Examples:
        from_int(0)  == sp.bytes("0x30")
        from_int(7)  == sp.bytes("0x37")
        from_int(10) == sp.bytes("0x3130")
        from_int(99) == sp.bytes("0x3939")
        from_int(-3) == sp.bytes("0x2d33")
        """
        sp.cast(n, sp.int)

        negative = n < 0
        v = sp.to_int(abs(n))
        out = sp.bytes("0x")

        # Special-case zero
        if v == 0:
            out = sp.bytes("0x30")
        else:
            pieces = []
            # Collect digits least-significant to most-significant
            while v > 0:
                (q, r) = sp.ediv(v, 10).unwrap_some()  # q, r are nat
                pieces.push(_digit_to_byte(sp.to_int(r)))
                v = q
            # Concatenate in correct order thanks to push semantics
            out = sp.concat(pieces)
        if not negative:
            return out
        else:
            return sp.bytes("0x2d") + out

    def from_nat(n):
        """Convert an integer to ASCII-encoded decimal bytes.

        Examples:
        from_nat(0)  == sp.bytes("0x30")
        from_nat(7)  == sp.bytes("0x37")
        from_nat(10) == sp.bytes("0x3130")
        from_nat(99) == sp.bytes("0x3939")
        """
        sp.cast(n, sp.nat)
        out = sp.bytes("0x")
        v=n

        # Special-case zero
        if v == 0:
            out = sp.bytes("0x30")
        else:
            pieces = []
            # Collect digits least-significant to most-significant
            while v > 0:
                (q, r) = sp.ediv(v, 10).unwrap_some()  # q, r are nat
                pieces.push(_digit_to_byte(sp.to_int(r)))
                v = q
            # Concatenate in correct order thanks to push semantics
            out = sp.concat(pieces)
        return out