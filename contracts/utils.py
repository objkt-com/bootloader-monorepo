import smartpy as sp

@sp.module
def bytes_utils():
    # Map a single digit (0..9) to its ASCII byte
    HEX_CHARS = {
            sp.bytes("0x00"): sp.bytes("0x30"),
            sp.bytes("0x01"): sp.bytes("0x31"),
            sp.bytes("0x02"): sp.bytes("0x32"),
            sp.bytes("0x03"): sp.bytes("0x33"),
            sp.bytes("0x04"): sp.bytes("0x34"),
            sp.bytes("0x05"): sp.bytes("0x35"),
            sp.bytes("0x06"): sp.bytes("0x36"),
            sp.bytes("0x07"): sp.bytes("0x37"),
            sp.bytes("0x08"): sp.bytes("0x38"),
            sp.bytes("0x09"): sp.bytes("0x39"),
            sp.bytes("0x0a"): sp.bytes("0x61"),
            sp.bytes("0x0b"): sp.bytes("0x62"),
            sp.bytes("0x0c"): sp.bytes("0x63"),
            sp.bytes("0x0d"): sp.bytes("0x64"),
            sp.bytes("0x0e"): sp.bytes("0x65"),
            sp.bytes("0x0f"): sp.bytes("0x66"),
        }

    def to_hex_ascii(b: sp.bytes) -> sp.bytes:
        """Convert a byte string into its ASCII-encoded lowercase hex string.

        Example:
        to_hex_ascii(sp.bytes("0x1a2b")) == sp.bytes("0x31613262")
        """
        out = sp.bytes("0x")
        n_bytes = sp.len(b)

        _h = sp.bytes("0xf0")
        _l = sp.bytes("0x0f")

        for i in range(n_bytes):
            byte = sp.slice(i, 1, b).unwrap_some()
            high = sp.rshift_bytes(sp.and_bytes(byte, _h), 4)
            low = sp.and_bytes(byte, _l)
            out += HEX_CHARS[high] + HEX_CHARS[low]

        return out
    
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
    
    def to_nat(b: sp.bytes) -> sp.nat:
        n_bytes = sp.len(b)
        bit_masks = [
            sp.bytes("0x01"),
            sp.bytes("0x02"),
            sp.bytes("0x04"),
            sp.bytes("0x08"),
            sp.bytes("0x10"),
            sp.bytes("0x20"),
            sp.bytes("0x40"),
            sp.bytes("0x80"),
        ]
        res = 0
        for i in range(n_bytes):
            byte = sp.slice(i, 1, b).unwrap_some()
            for bit_mask in bit_masks:
                if sp.and_bytes(byte, bit_mask) == bit_mask:
                    res = (res << 1) + 1
                else:
                    res = res << 1
        return res

@sp.module
def list_utils():
    def element_at(ab):
        """Return the element of a list at a particular index.

        Parameters:
        ab (sp.pair[sp.list[sp.bytes], sp.nat]): The pair '(elements, index').

        Returns:
        sp.int: The value in 'elements' at the 'index' position.

        Examples:
        import smartpy.stdlib.list_utils as list_utils
        list_utils.element_at(([1, 2, 3], 0)) == 1
        list_utils.element_at(([1, 2, 3], 1)) == 2
        list_utils.element_at(([1, 2, 3], 2)) == 3
        """
        (elements, idx) = sp.cast(ab, sp.pair[sp.list[sp.bytes], sp.nat])
        assert idx >= 0 and idx < sp.len(elements)
        it = 0
        res = sp.bytes("0x")
        brk = False
        for e in elements:
            if not brk:
                if it == idx:
                    res = e
                    brk = True
                it = it + 1
        return res
