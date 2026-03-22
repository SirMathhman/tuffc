if(NOT DEFINED APP_PATH)
    message(FATAL_ERROR "APP_PATH was not provided to the end-to-end test.")
endif()

if(NOT DEFINED EXPECTED_OUTPUT)
    message(FATAL_ERROR "EXPECTED_OUTPUT was not provided to the end-to-end test.")
endif()

execute_process(
    COMMAND "${APP_PATH}" greet Copilot
    RESULT_VARIABLE app_exit_code
    OUTPUT_VARIABLE app_stdout
    ERROR_VARIABLE app_stderr
    OUTPUT_STRIP_TRAILING_WHITESPACE
    ERROR_STRIP_TRAILING_WHITESPACE
)

if(NOT app_exit_code EQUAL 0)
    message(FATAL_ERROR "App exited with ${app_exit_code}. stderr: ${app_stderr}")
endif()

if(NOT app_stdout STREQUAL EXPECTED_OUTPUT)
    message(FATAL_ERROR "Expected '${EXPECTED_OUTPUT}' but got '${app_stdout}'.")
endif()