cmake_minimum_required(VERSION 3.16)
project(mflchain)

find_package(eosio.cdt)
add_contract(mflchain mflchain mflchain.cpp)
target_compile_features(mflchain PUBLIC cxx_std_17)

