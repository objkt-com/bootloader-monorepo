# Bootloader Test Suite

This directory contains comprehensive tests for the bootloader smart contract, broken down into focused test modules for better organization and maintainability.

## Test Files Overview

### 1. `test_admin_access_control.py`

**Purpose**: Tests all administrative functions and access control mechanisms

**What it tests**:

- **Admin-only operations**: Adding/removing moderators, setting administrator
- **Moderator permissions**: Setting treasury, platform fees, adding fragments, flagging generators
- **Access control enforcement**: Ensuring non-privileged users cannot perform restricted operations
- **Platform fee limits**: Validation that fees cannot exceed 100% (10000 BPS)

**Key test functions**:

- `test_admin_only_operations()` - Admin exclusive functions
- `test_moderator_permissions()` - Moderator capabilities
- `test_access_control_enforcement()` - Permission validation
- `test_platform_fee_limits()` - Fee boundary validation

### 2. `test_generator_management.py`

**Purpose**: Tests all generator-related functionality

**What it tests**:

- **Generator creation**: Basic creation, ID increment, initial state
- **Generator updates**: Author-only updates, version increment, reserved editions validation
- **Input validation**: Length limits for name, description, code, author bytes
- **Generator flagging**: Moderator/admin flagging capabilities
- **Byte limit configuration**: Dynamic limits and enforcement
- **Edge cases**: Large numbers, empty bytes handling

**Key test functions**:

- `test_generator_creation()` - Basic generator creation
- `test_generator_updates()` - Update functionality and permissions
- `test_input_validation()` - Length limit enforcement
- `test_generator_flagging()` - Moderation capabilities
- `test_byte_limit_configuration()` - Dynamic limit management

### 3. `test_sale_configuration.py`

**Purpose**: Tests all sale-related functionality

**What it tests**:

- **Sale configuration**: Author-only sale setup, parameter storage
- **Edition limits**: Validation, reduction rules, increment restrictions
- **Max per wallet**: Enforcement, different wallet handling
- **Sale states**: Paused, not started, price mismatch validation
- **Timestamp boundaries**: Exact timing validation
- **Edge cases**: Zero editions, large parameters, price exactness

**Key test functions**:

- `test_sale_configuration()` - Basic sale setup
- `test_edition_limits_and_reductions()` - Edition management rules
- `test_max_per_wallet()` - Wallet limit enforcement
- `test_sale_states()` - State validation
- `test_timestamp_boundaries()` - Timing edge cases

### 4. `test_minting_and_airdrop.py`

**Purpose**: Tests all minting-related functionality

**What it tests**:

- **Public minting**: Successful minting, token creation, state updates
- **Free minting**: Zero price handling, overpayment prevention
- **Airdrop functionality**: Author-only airdrops, reserved editions usage
- **Edition limits**: Public vs reserved edition handling
- **Sold out conditions**: Various sold out scenarios
- **Pause behavior**: Airdrop during paused sales

**Key test functions**:

- `test_public_minting()` - Standard minting flow
- `test_free_minting()` - Zero price minting
- `test_airdrop_functionality()` - Airdrop mechanics
- `test_reserved_editions_comprehensive()` - Reserved edition handling
- `test_sold_out_conditions()` - Sold out scenarios

### 5. `test_platform_fees_and_payments.py`

**Purpose**: Tests all payment-related functionality

**What it tests**:

- **Platform fee calculation**: Correct BPS calculation and distribution
- **Payment distribution**: Treasury vs author payment splits
- **Fee variations**: 0%, 100%, and various percentage fees
- **Payment failures**: Treasury rejection handling
- **Fee precision**: Small amounts, rounding behavior
- **Dynamic fee changes**: Fee updates affecting subsequent mints

**Key test functions**:

- `test_platform_fee_calculation()` - Fee calculation accuracy
- `test_maximum_platform_fee()` - 100% fee handling
- `test_zero_platform_fee()` - 0% fee handling
- `test_treasury_payment_failure()` - Payment failure scenarios
- `test_dynamic_fee_changes()` - Fee update behavior

### 6. `test_fa2_operations.py`

**Purpose**: Tests all FA2-related functionality

**What it tests**:

- **Token transfers**: FA2 transfer functionality, ownership changes
- **Token burning**: Owner-only burning, ledger cleanup
- **Token regeneration**: Version updates, owner-only regeneration
- **Thumbnail updates**: Author/moderator thumbnail management
- **Token metadata**: Metadata creation, iteration tracking
- **Ownership validation**: Owner-only operation enforcement

**Key test functions**:

- `test_token_transfers()` - FA2 transfer mechanics
- `test_token_burning()` - Burn functionality
- `test_token_regeneration()` - Version update system
- `test_thumbnail_updates()` - Thumbnail management
- `test_token_ownership_validation()` - Ownership enforcement

### 7. `test_external_dependencies.py`

**Purpose**: Tests external dependencies and edge cases

**What it tests**:

- **Fragment dependencies**: Missing fragment handling
- **RNG contract dependencies**: Missing view handling, contract updates
- **Fragment management**: Adding, overwriting, access control
- **Boundary conditions**: Maximum/minimum values, edge cases
- **State consistency**: Counter maintenance, proper tracking
- **Complex scenarios**: Multi-generator operations, mixed functionality

**Key test functions**:

- `test_missing_fragments()` - Fragment dependency validation
- `test_rng_contract_missing_view()` - RNG contract validation
- `test_boundary_conditions()` - Edge case handling
- `test_state_consistency()` - State management validation
- `test_complex_scenarios()` - Integration testing

## Running Tests

### Individual Test Files

To run a specific test file:

```bash
smartpy test contracts/tests/test_admin_access_control.py
smartpy test contracts/tests/test_generator_management.py
# ... etc for other files
```

### All Tests

To run all tests, you can run each file individually or use the comprehensive test in the original file:

```bash
smartpy test contracts/bootloader_test.py
```

## Test Structure

Each test file follows a consistent structure:

1. **Module docstring**: Describes the purpose and scope of tests
2. **Imports**: Required modules and utilities
3. **Test utilities**: Helper contracts and functions (when needed)
4. **Individual test functions**: Each testing a specific aspect
5. **Comprehensive documentation**: Each function documents exactly what it tests

## Key Testing Patterns

### Access Control Testing

- Tests both positive cases (authorized users can perform actions)
- Tests negative cases (unauthorized users cannot perform actions)
- Validates specific error messages

### State Validation

- Verifies state changes after operations
- Checks counter increments and decrements
- Validates data consistency across operations

### Edge Case Testing

- Tests boundary conditions (min/max values)
- Tests empty/zero values
- Tests large values and edge cases

### Integration Testing

- Tests complex scenarios combining multiple operations
- Validates state consistency across different generators
- Tests mixed operation sequences

## Benefits of This Structure

1. **Focused Testing**: Each file tests a specific aspect of functionality
2. **Easy Debugging**: When a test fails, it's easy to identify the problem area
3. **Maintainability**: Changes to specific functionality only require updating relevant test files
4. **Comprehensive Coverage**: All edge cases and scenarios are covered
5. **Clear Documentation**: Each test clearly documents what it's testing
6. **Parallel Development**: Different developers can work on different test files

## Test Coverage

The test suite provides comprehensive coverage of:

- ✅ All entrypoints and their parameters
- ✅ All access control mechanisms
- ✅ All error conditions and edge cases
- ✅ All state transitions and validations
- ✅ All external dependencies and interactions
- ✅ All mathematical calculations (fees, editions, etc.)
- ✅ All FA2 standard compliance
- ✅ All business logic and rules

This modular approach ensures that every aspect of the bootloader contract is thoroughly tested while maintaining code organization and readability.
