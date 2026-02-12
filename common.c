#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "main.h"
#include "common.h"
#include "stdint.h"

CompileResult compile(char *source)
{
    // TODO:

    return (CompileResult){
        .variant = OutputVariant,
        .output = {
            .headerCCode = "/* header C code */",
            .targetCCode = "/* target C code */",
        },
    };
}