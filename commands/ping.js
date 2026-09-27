/*
 * ============================================================
 * WEBTERM PING
 * Browser-based network ping
 *
 * NOTE:
 * Browsers cannot send ICMP packets.
 * This command measures HTTP/HTTPS round-trip time instead.
 * ============================================================
 */

export default {

    description: "Test network connectivity",

    async execute(args, terminal) {

        if (!args.length) {

            terminal.print(
                "ping: usage: ping <host>"
            );

            return;

        }


        /*
         * ----------------------------------------------------
         * Parse options
         * ----------------------------------------------------
         */

        let count = 4;

        let target = null;

        let continuous = false;

        for (let i = 0; i < args.length; i++) {

            const arg = args[i];


            /*
             * -c COUNT
             */

            if (arg === "-c") {

                const value =
                    Number(args[++i]);

                if (
                    !Number.isInteger(value) ||
                    value <= 0
                ) {

                    terminal.print(
                        "ping: invalid count"
                    );

                    return;

                }

                count = value;

                continue;

            }


            /*
             * -t
             *
             * Continuous mode
             */

            if (arg === "-t") {

                continuous = true;

                continue;

            }


            /*
             * Host
             */

            if (!arg.startsWith("-")) {

                target = arg;

            }

        }


        if (!target) {

            terminal.print(
                "ping: missing host"
            );

            return;

        }


        /*
         * ----------------------------------------------------
         * Convert target to URL
         * ----------------------------------------------------
         */

        let url;

        try {

            url = normalizeTarget(target);

        } catch (error) {

            terminal.print(
                `ping: ${error.message}`
            );

            return;

        }


        /*
         * ----------------------------------------------------
         * Header
         * ----------------------------------------------------
         */

        terminal.print("");

        terminal.print(
            `PING ${target}`
        );


        /*
         * ----------------------------------------------------
         * Statistics
         * ----------------------------------------------------
         */

        let transmitted = 0;

        let received = 0;

        let lost = 0;

        const times = [];


        /*
         * ----------------------------------------------------
         * Continuous ping
         * ----------------------------------------------------
         */

        if (continuous) {

            terminal.print(
                "Press Ctrl+C to stop"
            );

            while (true) {

                const result =
                    await performPing(url);

                transmitted++;

                displayResult(
                    result,
                    transmitted,
                    target,
                    terminal
                );

                if (result.success) {

                    received++;

                    times.push(
                        result.time
                    );

                } else {

                    lost++;

                }

                await sleep(1000);

            }

        }


        /*
         * ----------------------------------------------------
         * Normal ping
         * ----------------------------------------------------
         */

        for (
            let sequence = 1;
            sequence <= count;
            sequence++
        ) {

            const result =
                await performPing(url);

            transmitted++;

            displayResult(
                result,
                sequence,
                target,
                terminal
            );


            if (result.success) {

                received++;

                times.push(
                    result.time
                );

            } else {

                lost++;

            }


            /*
             * Wait between packets
             */

            if (
                sequence < count
            ) {

                await sleep(1000);

            }

        }


        /*
         * ----------------------------------------------------
         * Statistics
         * ----------------------------------------------------
         */

        printStatistics(
            target,
            transmitted,
            received,
            lost,
            times,
            terminal
        );

    }

};


/*
 * ============================================================
 * NORMALIZE TARGET
 * ============================================================
 */

function normalizeTarget(target) {

    /*
     * Already URL
     */

    if (
        target.startsWith("http://") ||
        target.startsWith("https://")
    ) {

        return target;

    }


    /*
     * Domain / hostname
     */

    return `https://${target}`;

}


/*
 * ============================================================
 * PERFORM BROWSER PING
 * ============================================================
 */

async function performPing(url) {

    const start =
        performance.now();


    /*
     * Cache-busting query.
     *
     * Prevents browser cache from
     * returning the result immediately.
     */

    const separator =
        url.includes("?")
            ? "&"
            : "?";


    const pingURL =
        `${url}${separator}_webterm_ping=${Date.now()}_${Math.random()}`;


    try {

        /*
         * no-cors allows requests to many external
         * hosts even when their response isn't readable.
         *
         * We only need timing here.
         */

        await fetch(
            pingURL,
            {
                method: "HEAD",

                mode: "no-cors",

                cache: "no-store",

                signal: AbortSignal.timeout(5000)
            }
        );


        const time =
            performance.now() - start;


        return {

            success: true,

            time: time

        };

    } catch (error) {

        const time =
            performance.now() - start;


        return {

            success: false,

            time: time,

            error: error

        };

    }

}


/*
 * ============================================================
 * DISPLAY RESULT
 * ============================================================
 */

function displayResult(
    result,
    sequence,
    target,
    terminal
) {

    if (result.success) {

        terminal.print(
            `${target}: reply seq=${sequence} time=${formatTime(result.time)} ms`
        );

    } else {

        terminal.print(
            `${target}: Request timeout`
        );

    }

}


/*
 * ============================================================
 * FORMAT TIME
 * ============================================================
 */

function formatTime(time) {

    return Math.round(
        time * 100
    ) / 100;

}


/*
 * ============================================================
 * STATISTICS
 * ============================================================
 */

function printStatistics(
    target,
    transmitted,
    received,
    lost,
    times,
    terminal
) {

    terminal.print("");

    terminal.print(
        `--- ${target} ping statistics ---`
    );

    const loss =
        transmitted === 0
            ? 0
            : (lost / transmitted) * 100;


    terminal.print(
        `${transmitted} packets transmitted, ${received} received, ${Math.round(loss)}% packet loss`
    );


    if (times.length) {

        const min =
            Math.min(...times);

        const max =
            Math.max(...times);

        const avg =
            times.reduce(
                (sum, value) =>
                    sum + value,
                0
            ) / times.length;


        terminal.print(
            `round-trip min/avg/max = ${formatTime(min)}/${formatTime(avg)}/${formatTime(max)} ms`
        );

    }

}


/*
 * ============================================================
 * SLEEP
 * ============================================================
 */

function sleep(ms) {

    return new Promise(
        resolve =>
            setTimeout(
                resolve,
                ms
            )
    );

}
