/** biome-ignore-all lint/style/noUselessElse: <For clarity> */
import { tool } from "@langchain/core/tools";
import { z } from "zod";

/**
 * DateTime Tool
 *
 * Provides current date and time information to LLMs.
 * This helps prevent hallucinations about temporal context.
 *
 * Usage: When LLM needs to know:
 * - Current date/time
 * - What year it is
 * - How old something is
 * - Time-based calculations
 */

// Time conversion constants
const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const DAYS_PER_MONTH_AVG = 30.44;
const DAYS_PER_YEAR_AVG = 365.25;

const MS_PER_MINUTE = MS_PER_SECOND * SECONDS_PER_MINUTE;
const MS_PER_HOUR = MS_PER_MINUTE * MINUTES_PER_HOUR;
const MS_PER_DAY = MS_PER_HOUR * HOURS_PER_DAY;
const MS_PER_MONTH = MS_PER_DAY * DAYS_PER_MONTH_AVG;
const MS_PER_YEAR = MS_PER_DAY * DAYS_PER_YEAR_AVG;
const GetCurrentDateTimeInputSchema = z
  .object({
    timezone: z
      .string()
      .optional()
      .describe(
        "Optional timezone (e.g., 'America/New_York', 'UTC'). Defaults to system timezone."
      ),
    format: z
      .enum(["full", "date", "time", "iso", "unix"])
      .optional()
      .describe(
        "Output format: 'full' (human readable), 'date' (date only), 'time' (time only), 'iso' (ISO 8601), 'unix' (timestamp)"
      ),
  })
  .describe("Input for getting current date and time");

/**
 * Get Current Date and Time
 *
 * Returns the current date and time in various formats.
 * Useful for temporal context in research and analysis.
 */
export const getCurrentDateTime = tool(
  ({ timezone, format = "full" }) => {
    try {
      const now = new Date();

      // Apply timezone if specified
      let targetDate = now;
      if (timezone) {
        // Convert to target timezone
        const options: Intl.DateTimeFormatOptions = {
          timeZone: timezone,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        };

        // Parse back to Date object
        const formatter = new Intl.DateTimeFormat("en-US", options);
        const parts = formatter.formatToParts(targetDate);
        const values: Record<string, string> = {};
        for (const part of parts) {
          values[part.type] = part.value;
        }

        targetDate = new Date(
          `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}:${values.second}`
        );
      }

      // Format output based on requested format
      if (format === "date") {
        return targetDate.toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
          timeZone: timezone,
        });
      }

      if (format === "time") {
        return targetDate.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          timeZone: timezone,
        });
      }

      if (format === "iso") {
        return targetDate.toISOString();
      }

      if (format === "unix") {
        return Math.floor(targetDate.getTime() / MS_PER_SECOND).toString();
      }

      // Default: full format
      return targetDate.toLocaleString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        timeZone: timezone,
      });
    } catch (error) {
      return `Error getting date/time: ${error instanceof Error ? error.message : "Unknown error"}`;
    }
  },
  {
    name: "get_current_datetime",
    description:
      "Get the current date and time. Use this when you need to know what date or time it is right now. This is essential for understanding temporal context, determining if information is recent or outdated, and avoiding assumptions about the current date.",
    schema: GetCurrentDateTimeInputSchema,
  }
);

/**
 * Calculate Date Difference
 *
 * Calculates the difference between two dates or between a date and now.
 */
const CalculateDateDifferenceInputSchema = z
  .object({
    fromDate: z
      .string()
      .describe(
        "Start date in ISO format (e.g., '2024-01-15') or natural language (e.g., 'January 15, 2024')"
      ),
    toDate: z
      .string()
      .optional()
      .describe(
        "End date in ISO format or natural language. If omitted, uses current date."
      ),
    unit: z
      .enum(["days", "months", "years", "hours", "minutes"])
      .optional()
      .describe("Unit to return the difference in. Defaults to 'days'."),
  })
  .describe("Input for calculating date difference");

export const calculateDateDifference = tool(
  ({ fromDate, toDate, unit = "days" }) => {
    try {
      const start = new Date(fromDate);
      const end = toDate ? new Date(toDate) : new Date();

      if (Number.isNaN(start.getTime())) {
        return `Error: Invalid start date '${fromDate}'`;
      }

      if (Number.isNaN(end.getTime())) {
        return `Error: Invalid end date '${toDate}'`;
      }

      const diffMs = end.getTime() - start.getTime();

      let result: number;
      let unitLabel: string;

      if (unit === "minutes") {
        result = Math.floor(diffMs / MS_PER_MINUTE);
        unitLabel = "minutes";
      } else if (unit === "hours") {
        result = Math.floor(diffMs / MS_PER_HOUR);
        unitLabel = "hours";
      } else if (unit === "days") {
        result = Math.floor(diffMs / MS_PER_DAY);
        unitLabel = "days";
      } else if (unit === "months") {
        result = Math.floor(diffMs / MS_PER_MONTH);
        unitLabel = "months";
      } else if (unit === "years") {
        result = Math.floor(diffMs / MS_PER_YEAR);
        unitLabel = "years";
      } else {
        result = Math.floor(diffMs / MS_PER_DAY);
        unitLabel = "days";
      }

      const startStr = start.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
      const endStr = end.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });

      return `${result} ${unitLabel} from ${startStr} to ${endStr}`;
    } catch (error) {
      return `Error calculating date difference: ${error instanceof Error ? error.message : "Unknown error"}`;
    }
  },
  {
    name: "calculate_date_difference",
    description:
      "Calculate the time difference between two dates, or between a date and now. Useful for determining how old information is, time since publication, etc.",
    schema: CalculateDateDifferenceInputSchema,
  }
);

/**
 * All datetime tools for export
 */
export const datetimeTools = [getCurrentDateTime, calculateDateDifference];
