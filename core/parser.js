/*
 * ============================================================
 * WEBTERM COMMAND PARSER
 * ============================================================
 */

export function tokenize(command) {

    const tokens = [];

    let current = "";

    let quote = null;

    let escape = false;

    for (let i = 0; i < command.length; i++) {

        const char = command[i];


        if (escape) {

            current += char;

            escape = false;

            continue;

        }


        if (char === "\\") {

            escape = true;

            continue;

        }


        if (quote) {

            if (char === quote) {

                quote = null;

            } else {

                current += char;

            }

            continue;

        }


        if (
            char === '"' ||
            char === "'"
        ) {

            quote = char;

            continue;

        }


        if (/\s/.test(char)) {

            if (current) {

                tokens.push(current);

                current = "";

            }

            continue;

        }


        current += char;

    }


    if (current) {

        tokens.push(current);

    }


    return tokens;

}
