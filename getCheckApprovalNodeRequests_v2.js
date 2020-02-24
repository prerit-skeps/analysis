const { existsSync, readdirSync, lstatSync, readFileSync, writeFileSync, mkdirSync } = require("fs");
const { join, resolve } = require("path");
const readline = require("readline");
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});
const piiToRemove = ["emailAddress", "firstName", "socialSecurityNumber", "lastName", "city", "streetAddress1", "streetAddress2", "dateOfBirth", "cellPhone", "zipcode"];
let writtenFiles = 0;

const getInput = (question) => {
    return new Promise((res, rej) => {
        rl.question(question, (answer) => {
            res(answer);
        });
    });
}

const main = async () => {
    try {
        // get the logs folder
        const folder = await getInput("Enter path to folder that contains that 'logs' directory: ");
        if (!existsSync(join(folder, "logs"))) {
            throw new Error("'logs' directory not found under given path " + resolve(folder));
        }

        // get the output folder
        const outputDirectory = await getInput("Enter path to output folder: ");
        if (!existsSync(outputDirectory)) {
            mkdirSync(outputDirectory);
        }

        // get years inside the logs folder
        const years = readdirSync(join(folder, "logs")).filter(f => lstatSync(join(folder, "logs", f)).isDirectory()).filter(f => /^\d+$/.test(f));
        if (years.length <= 0) {
            throw new Error("no matching years directory found under 'logs' directory")
        }

        // select a year
        const selectedYearIndex = await getInput("Select a year: " + years.map((y, i) => (i + 1) + ") " + y + " ").join(" ") + ":");
        const selectedYear = years[selectedYearIndex - 1];
        if (!(/^\d+$/.test(selectedYear) && selectedYearIndex <= years.length)) {
            throw new Error("invalid selected year: " + selectedYear);
        }

        // get months inside the year folder
        const months = readdirSync(join(folder, "logs", selectedYear)).filter(f => lstatSync(join(folder, "logs", selectedYear, f)).isDirectory()).filter(f => /^\d+$/.test(f));
        if (months.length <= 0) {
            throw new Error("no matching months directory found under '" + selectedYear + "' directory")
        }

        // select a month
        const selectedMonthIndex = await getInput("Select a month: " + months.map((y, i) => (i + 1) + ") " + y + " ").join(" ") + ":");
        rl.close();
        const selectedMonth = months[selectedMonthIndex - 1];
        if (!(/^\d+$/.test(selectedMonth) && selectedMonthIndex <= months.length)) {
            throw new Error("invalid selected month: " + selectedMonth);
        }

        // get pointCodes inside the month folder
        console.log("reading logs from " + join(folder, "logs", selectedYear, selectedMonth));
        const pointCodes = readdirSync(join(folder, "logs", selectedYear, selectedMonth)).filter(f => lstatSync(join(folder, "logs", selectedYear, selectedMonth, f)).isDirectory()).filter(f => readdirSync(join(folder, "logs", selectedYear, selectedMonth, f)).some(r => r.startsWith("ca_") && r.endsWith("_node_req.json")));
        if (pointCodes.length <= 0) {
            throw new Error("no pointCodes with valid node checkApproval request found under '" + selectedMonth + "' directory");
        }
        console.log("found " + pointCodes.length + " matching pointCodes, reading node checkApproval request files...");

        // read node checkApproval request files
        for (const pointCode of pointCodes) {
            const requestFiles = readdirSync(join(folder, "logs", selectedYear, selectedMonth, pointCode)).filter(f => f.startsWith("ca_") && f.endsWith("_node_req.json"));
            if (requestFiles.length <= 0) continue;

            // loop through matching request files
            for (const [index, requestFile] of requestFiles.entries()) {
                const requestData = readFileSync(join(folder, "logs", selectedYear, selectedMonth, pointCode, requestFile), "utf-8");
                try {
                    const requestDataJSON = JSON.parse(requestData);

                    // remove pii from request
                    if ("data" in requestDataJSON) {
                        for (const pii of piiToRemove) {
                            if (pii in requestDataJSON.data) delete requestDataJSON.data[pii];
                        }
                    }

                    // save request
                    writeFileSync(join(outputDirectory, index == 0 ? pointCode + ".json" : pointCode + "_" + index + ".json"), JSON.stringify(requestDataJSON), "utf-8");
                    writtenFiles++;
                } catch (err) {
                    console.log("unable to parse file pointCode: " + pointCode + ", fileName: " + requestFile);
                }
            }
        }
        console.log("removing pii data from files...");
        console.log("written " + writtenFiles + " files to folder: " + outputDirectory);
        process.exit();
    } catch (e) {
        console.log("error in process", e);
        process.exit();
    }
}

main();