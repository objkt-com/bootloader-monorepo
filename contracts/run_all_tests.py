#!/usr/bin/env python3
"""
Test runner for all SmartPy test modules in the tests directory.
This script imports and executes all test modules, providing progress feedback.
"""

import os
import sys
import importlib.util
import traceback
from pathlib import Path

def print_header(text):
    """Print a formatted header"""
    print(f"\n{'='*60}")
    print(f" {text}")
    print(f"{'='*60}")

def print_subheader(text):
    """Print a formatted subheader"""
    print(f"\n{'-'*40}")
    print(f" {text}")
    print(f"{'-'*40}")

def load_and_run_test_module(test_file_path):
    """
    Load and execute a SmartPy test module.
    
    Args:
        test_file_path (Path): Path to the test file
        
    Returns:
        bool: True if successful, False if failed
    """
    module_name = test_file_path.stem
    
    try:
        print(f"📁 Loading module: {module_name}")
        
        # Load the module
        spec = importlib.util.spec_from_file_location(module_name, test_file_path)
        if spec is None or spec.loader is None:
            print(f"❌ Failed to create module spec for {module_name}")
            return False
            
        module = importlib.util.module_from_spec(spec)
        
        # Add the contracts directory to sys.path so imports work
        contracts_dir = str(test_file_path.parent.parent)
        if contracts_dir not in sys.path:
            sys.path.insert(0, contracts_dir)
        
        print(f"⚙️  Executing module: {module_name}")
        spec.loader.exec_module(module)
        
        print(f"✅ Successfully executed: {module_name}")
        return True
        
    except ImportError as e:
        print(f"❌ Import error in {module_name}: {e}")
        print(f"   Make sure all dependencies are available")
        return False
    except Exception as e:
        print(f"❌ Error executing {module_name}: {e}")
        print(f"   Traceback:")
        traceback.print_exc()
        return False

def main():
    """Main test runner function"""
    print_header("SmartPy Test Suite Runner")
    
    # Get the directory containing this script
    script_dir = Path(__file__).parent
    tests_dir = script_dir / "tests"
    
    if not tests_dir.exists():
        print(f"❌ Tests directory not found: {tests_dir}")
        sys.exit(1)
    
    print(f"📂 Looking for test files in: {tests_dir}")
    
    # Find all Python test files
    test_files = []
    for file_path in tests_dir.glob("test_*.py"):
        test_files.append(file_path)
    
    if not test_files:
        print("❌ No test files found matching pattern 'test_*.py'")
        sys.exit(1)
    
    test_files.sort()  # Sort for consistent execution order
    
    print(f"🔍 Found {len(test_files)} test files:")
    for test_file in test_files:
        print(f"   • {test_file.name}")
    
    print_subheader("Starting Test Execution")
    
    # Track results
    successful_tests = []
    failed_tests = []
    
    # Execute each test file
    for i, test_file in enumerate(test_files, 1):
        print_subheader(f"Test {i}/{len(test_files)}: {test_file.name}")
        
        if load_and_run_test_module(test_file):
            successful_tests.append(test_file.name)
        else:
            failed_tests.append(test_file.name)
    
    # Print summary
    print_header("Test Execution Summary")
    
    print(f"📊 Total tests: {len(test_files)}")
    print(f"✅ Successful: {len(successful_tests)}")
    print(f"❌ Failed: {len(failed_tests)}")
    
    if successful_tests:
        print(f"\n✅ Successful tests:")
        for test in successful_tests:
            print(f"   • {test}")
    
    if failed_tests:
        print(f"\n❌ Failed tests:")
        for test in failed_tests:
            print(f"   • {test}")
        print(f"\n⚠️  Check the error messages above for details on failures.")
    
    # Exit with appropriate code
    if failed_tests:
        print(f"\n🚨 {len(failed_tests)} test(s) failed!")
        sys.exit(1)
    else:
        print(f"\n🎉 All tests passed successfully!")
        sys.exit(0)

if __name__ == "__main__":
    main()
