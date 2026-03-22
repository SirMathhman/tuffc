cmake_minimum_required(VERSION 3.20)

project(tuffc VERSION 0.1.0 LANGUAGES C)

set(CMAKE_C_STANDARD 11)
set(CMAKE_C_STANDARD_REQUIRED ON)
set(CMAKE_C_EXTENSIONS OFF)

add_library(tuffc_lib
    src/app.c
)

target_include_directories(tuffc_lib
    PUBLIC
        ${PROJECT_SOURCE_DIR}/include
)

if(MSVC)
    target_compile_options(tuffc_lib PRIVATE /W4)
else()
    target_compile_options(tuffc_lib PRIVATE -Wall -Wextra -Wpedantic)
endif()

add_executable(tuffc
    src/main.c
)

target_link_libraries(tuffc PRIVATE tuffc_lib)

include(CTest)

if(BUILD_TESTING)
    add_test(
        NAME e2e_greet
        COMMAND ${CMAKE_COMMAND}
            -DAPP_PATH=$<TARGET_FILE:tuffc>
            "-DEXPECTED_OUTPUT=Hello, Copilot!"
            -P ${PROJECT_SOURCE_DIR}/tests/e2e_greet.cmake
    )
endif()