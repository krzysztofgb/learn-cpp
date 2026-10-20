// Precompiled into every snippet (via -include-pch). Keep it to the standard library.
#include <algorithm>
#include <any>
#include <array>
#include <atomic>
#include <bit>
#include <bitset>
#include <cassert>
#include <cctype>
#include <cxxabi.h>
#include <charconv>
#include <chrono>
#include <cinttypes>
#include <climits>
#include <cmath>
#include <compare>
#include <complex>
#include <concepts>
#include <condition_variable>
#include <cstddef>
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <deque>
#include <exception>
#include <expected>
#include <format>
#include <forward_list>
#include <functional>
#include <initializer_list>
#include <iomanip>
#include <iostream>
#include <iterator>
#include <limits>
#include <list>
#include <map>
#include <memory>
#include <memory_resource>
#include <mutex>
#include <new>
#include <numbers>
#include <numeric>
#include <optional>
#include <print>
#include <queue>
#include <random>
#include <ranges>
#include <set>
#include <span>
#include <sstream>
#include <stack>
#include <stdexcept>
#include <string>
#include <string_view>
#include <tuple>
#include <type_traits>
#include <typeinfo>
#include <unordered_map>
#include <unordered_set>
#include <utility>
#include <variant>
#include <vector>

// Instantiates the common std::format/std::print paths once, so -fpch-codegen emits them into
// prelude.o instead of every snippet paying ~3 s to instantiate them.
namespace learn_cpp_prelude {
inline void instantiate_format() {
  (void)std::format("{} {} {} {} {} {} {}", 1, 1u, 1L, 1UL, 1LL, 1ULL, 1.0);
  (void)std::format("{} {} {} {} {}", 'c', "s", std::string{"s"}, std::string_view{"s"}, true);
  (void)std::format("{} {}", 1.0f, static_cast<const void*>(nullptr));
  std::print("{} {} {} {}", 1, "s", 1.0, std::string{"s"});
  std::println("{} {} {} {}", 1, "s", 1.0, std::string{"s"});
}
}  // namespace learn_cpp_prelude

// Runtime support. WebAssembly exception handling has no unwinder search phase, so an exception
// that escapes main() surfaces in JavaScript instead of calling std::terminate; the runner calls
// learn_cpp_describe_exception() to report it the way native libc++ would. The terminate handler
// makes std::terminate (e.g. a throw out of a noexcept function) print libc++'s message too,
// so it isn't mistaken for a UBSan trap, which aborts silently.
namespace learn_cpp_prelude {
inline std::string describe_current_exception() {
  const std::type_info* type = __cxxabiv1::__cxa_current_exception_type();
  if (!type) return {};
  int status = 0;
  char* demangled = abi::__cxa_demangle(type->name(), nullptr, nullptr, &status);
  std::string description = demangled ? demangled : type->name();
  std::free(demangled);
  try {
    std::rethrow_exception(std::current_exception());
  } catch (const std::exception& error) {
    description += ": ";
    description += error.what();
  } catch (...) {
  }
  return description;
}

[[noreturn]] inline void on_terminate() noexcept {
  const std::string description = describe_current_exception();
  if (description.empty()) {
    std::fputs("libc++abi: terminating\n", stderr);
  } else {
    std::fprintf(stderr, "libc++abi: terminating due to uncaught exception of type %s\n", description.c_str());
  }
  std::abort();
}

[[gnu::used]] inline const bool terminate_handler_installed = (std::set_terminate(on_terminate), true);
}  // namespace learn_cpp_prelude

extern "C" [[gnu::used]] __attribute__((export_name("learn_cpp_describe_exception"))) inline const char* learn_cpp_describe_exception(
    void* unwind_exception) {
  static std::string description;
  __cxxabiv1::__cxa_begin_catch(unwind_exception);
  description = learn_cpp_prelude::describe_current_exception();
  __cxxabiv1::__cxa_end_catch();
  return description.c_str();
}
