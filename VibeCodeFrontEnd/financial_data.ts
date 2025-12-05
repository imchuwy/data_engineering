'use server';

// This file reads and processes historical financial data from a local CSV file.
// In a real-world scenario, you might replace this with API calls.

import type { Instrument } from '@/lib/types';
import fs from 'fs';
import path from 'path';

type PriceRecord = {
    date: Date;
    price: number;
};

/**
 * Reads and parses the instrument data from the CSV file.
 * @returns A promise that resolves to a map of instrument symbols to their historical price records.
 */
async function parseCsvData(): Promise<Map<string, PriceRecord[]>> {
    const data = new Map<string, PriceRecord[]>();
    // CSV is stored alongside the app under src/data/instrument_data.csv.
    const filePath = path.join(process.cwd(), 'src', 'data', 'instrument_data.csv');

    try {
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const rows = fileContent.split('\n').slice(1); // Skip header row (date,symbol,price)

        for (const row of rows) {
            if (!row) continue;
            const [dateStr, symbol, priceStr] = row.split(',');
            if (!dateStr || !symbol || !priceStr) continue;

            const price = parseFloat(priceStr);
            const record = { date: new Date(dateStr), price };

            if (!data.has(symbol)) {
                data.set(symbol, []);
            }
            data.get(symbol)?.push(record);
        }

        // Sort records by date for each symbol
        for (const symbol of data.keys()) {
            data.get(symbol)?.sort((a, b) => a.date.getTime() - b.date.getTime());
        }
    } catch (error) {
        console.error('Error reading or parsing CSV file:', error);
        // In a production app, you'd want more robust error handling.
        // For this demo, we'll return an empty map if the file is not found.
        return new Map();
    }

    return data;
}

/**
 * Calculates daily returns from a series of price records.
 * @param prices Array of price records, sorted by date.
 * @returns An array of daily percentage returns.
 */
function calculateDailyReturns(prices: PriceRecord[]): number[] {
    const returns: number[] = [];
    for (let i = 1; i < prices.length; i++) {
        const yesterdayPrice = prices[i - 1].price;
        const todayPrice = prices[i].price;
        if (yesterdayPrice === 0) {
            // Avoid divide-by-zero; treat as flat day
            returns.push(0);
        } else {
            const dailyReturn = (todayPrice - yesterdayPrice) / yesterdayPrice;
            returns.push(dailyReturn);
        }
    }
    return returns;
}

/**
 * "Fetches" historical daily returns for a list of instruments by reading a local CSV.
 * @param instruments The list of instruments.
 * @returns A promise that resolves to a map of instrument symbols to their array of daily returns.
 */
export async function getHistoricalData(
    instruments: Instrument[]
): Promise<Map<string, number[]>> {
    const allPriceData = await parseCsvData();
    const returnsData = new Map<string, number[]>();

    for (const instrument of instruments) {
        const instrumentPrices = allPriceData.get(instrument.symbol);
        if (instrumentPrices && instrumentPrices.length > 1) {
            const dailyReturns = calculateDailyReturns(instrumentPrices);
            returnsData.set(instrument.symbol, dailyReturns);
        } else {
            // If no data for a symbol, return an empty array to avoid errors downstream
            returnsData.set(instrument.symbol, []);
        }
    }

    return returnsData;
}
