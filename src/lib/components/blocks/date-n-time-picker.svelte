<script lang="ts">
    import { cn } from "$lib/utils.js";
    import Calendar from "$lib/components/ui/calendar/calendar.svelte";
    import * as Popover from "$lib/components/ui/popover/index.js";
    import { Button } from "$lib/components/ui/button/index.js";
    import { Label } from "$lib/components/ui/label/index.js";
    import { Input } from "$lib/components/ui/input/index.js";
    import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";
    import { parseDate } from "chrono-node";
    import { untrack } from "svelte";
    import {
        CalendarDate,
        getLocalTimeZone,
        Time,
        toCalendarDate,
        toCalendarDateTime,
        toTimeZone,
        toZoned
    } from "@internationalized/date";
    import type { ZonedDateTime } from "@internationalized/date";
    import Kbd from "../ui/kbd/kbd.svelte";

    const generatedId = $props.id();

    type Props = {
        id?: string;
        value?: ZonedDateTime;
        timeZone?: string;
        class?: string;
        nlpDateTimeLabel?: string;
        dateLabel?: string;
        timeLabel?: string;
        datePlaceholder?: string;
        timeStep?: string;
    };

    const DEFAULT_TIME = "10:30:00";
    const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    const twoDigits = (num: number) => String(num).padStart(2, "0");

    const zonedKey = (val: ZonedDateTime | undefined) => val?.toString();

    const parseTime = (time: string) => {
        const [h = "0", m = "0", s = "0"] = time.split(":");
        const hour = Number.parseInt(h, 10);
        const minute = Number.parseInt(m, 10);
        const second = Number.parseInt(s, 10);

        return {
            hour: Number.isNaN(hour) ? 0 : Math.min(Math.max(hour, 0), 23),
            minute: Number.isNaN(minute) ? 0 : Math.min(Math.max(minute, 0), 59),
            second: Number.isNaN(second) ? 0 : Math.min(Math.max(second, 0), 59)
        };
    };

    const formatOffset = (offsetMs: number) => {
        const sign = offsetMs >= 0 ? "+" : "-";
        const absTotalMinutes = Math.abs(Math.trunc(offsetMs / 60000));
        const hours = Math.floor(absTotalMinutes / 60);
        const minutes = absTotalMinutes % 60;

        return `UTC${sign}${twoDigits(hours)}:${twoDigits(minutes)}`;
    };

    const formatNlpDateTime = (val: ZonedDateTime | undefined) => {
        if (!val) {
            return "";
        }

        const month = MONTHS_SHORT[val.month - 1] ?? "";
        return `${twoDigits(val.day)} ${month}, ${val.year} at ${twoDigits(val.hour)}:${twoDigits(val.minute)}:${twoDigits(val.second)} ${formatOffset(val.offset)}`;
    };

    const parseNlpDateTime = (text: string, targetTimeZone: string) => {
        if (!text.trim()) {
            return undefined;
        }

        const parsed = parseDate(text);
        if (!parsed) {
            return undefined;
        }

        // Use local date components (not absolute ms) so the key is deterministic
        // across repeated calls for the same input text.
        const calDate = new CalendarDate(parsed.getFullYear(), parsed.getMonth() + 1, parsed.getDate());
        const calTime = new Time(parsed.getHours(), parsed.getMinutes(), parsed.getSeconds());
        return toZoned(toCalendarDateTime(calDate, calTime), targetTimeZone);
    };

    let {
        id = generatedId,
        value = $bindable<ZonedDateTime | undefined>(),
        timeZone = getLocalTimeZone(),
        class: className,
        nlpDateTimeLabel = "Date and time (NLP)",
        dateLabel = "Date",
        timeLabel = "Time",
        datePlaceholder = "Select date",
        timeStep = "1"
    }: Props = $props();

    let open = $state(false);
    let nlpInput = $state("");
    let isNlpFocused = $state(false);
    let selectedDate = $state<CalendarDate | undefined>();
    let selectedTime = $state(DEFAULT_TIME);
    let syncedValueKey = $state<string | undefined>();

    const syncFromExternalValue = (nextValue: ZonedDateTime | undefined) => {
        if (!nextValue) {
            selectedDate = undefined;
            selectedTime = DEFAULT_TIME;
            if (!isNlpFocused) {
                nlpInput = "";
            }
            return;
        }

        const normalized = nextValue.timeZone === timeZone ? nextValue : toTimeZone(nextValue, timeZone);

        selectedDate = toCalendarDate(normalized);
        selectedTime = `${twoDigits(normalized.hour)}:${twoDigits(normalized.minute)}:${twoDigits(normalized.second)}`;
        if (!isNlpFocused) {
            nlpInput = formatNlpDateTime(normalized);
        }
    };

    $effect(() => {
        const nextKey = zonedKey(value);

        if (nextKey !== syncedValueKey) {
            syncFromExternalValue(value);
            syncedValueKey = nextKey;
        }
    });

    $effect(() => {
        const parsedNlpValue = parseNlpDateTime(nlpInput, timeZone);
        if (!parsedNlpValue) {
            return;
        }

        const parsedNlpKey = parsedNlpValue.toString();
        // untrack value so that downstream effects updating value
        // do not re-trigger this effect and cause a parse loop.
        if (untrack(() => zonedKey(value)) !== parsedNlpKey) {
            const normalized =
                parsedNlpValue.timeZone === timeZone ? parsedNlpValue : toTimeZone(parsedNlpValue, timeZone);

            selectedDate = toCalendarDate(normalized);
            selectedTime = `${twoDigits(normalized.hour)}:${twoDigits(normalized.minute)}:${twoDigits(normalized.second)}`;
            value = parsedNlpValue;
            syncedValueKey = parsedNlpKey;
        }
    });

    $effect(() => {
        if (!selectedDate) {
            if (value !== undefined) {
                value = undefined;
                syncedValueKey = undefined;
                if (!isNlpFocused) {
                    nlpInput = "";
                }
            }
            return;
        }

        const { hour, minute, second } = parseTime(selectedTime);
        const nextTime = new Time(hour, minute, second);
        const nextDateTime = toCalendarDateTime(selectedDate, nextTime);
        const nextValue = toZoned(nextDateTime, timeZone);
        const nextKey = nextValue.toString();

        if (zonedKey(value) !== nextKey) {
            value = nextValue;
            syncedValueKey = nextKey;
            if (!isNlpFocused) {
                nlpInput = formatNlpDateTime(nextValue);
            }
        }
    });
</script>

<div class={cn("flex w-full gap-3 justify-center sm:justify-start items-center flex-wrap", className)}>
    <div class="w-full h-max flex flex-col gap-1.5">
        <Label for={`${id}-nlp`} class="px-1">{nlpDateTimeLabel}</Label>
        <Input
            id={`${id}-nlp`}
            bind:value={nlpInput}
            autocomplete="off"
            placeholder="In 2 days at 18:30"
            class="mt-0! text-base"
            onfocus={() => {
                isNlpFocused = true;
            }}
            onblur={() => {
                isNlpFocused = false;
            }}
        />
    </div>

    <Kbd class="h-fit text-lg font-bold p-2 py-0.5 mr-2 min-[29rem]:mr-3 sm:mx-4">OR</Kbd>

    <div class="w-full min-[52ch]:w-auto h-full flex flex-row gap-3 flex-wrap shrink-0">
        <div data-slot="input-date" class="w-full min-[29rem]:w-[16ch] h-max flex flex-col gap-1.5 shrink-0">
            <Label for={`${id}-date`} class="px-1">{dateLabel}</Label>
            <Popover.Root bind:open>
                <Popover.Trigger id={`${id}-date`}>
                    {#snippet child({ props })}
                        <Button
                            {...props}
                            variant="outline"
                            class="w-full justify-between font-normal text-base bg-transparent border-border"
                        >
                            {selectedDate
                                ? selectedDate
                                    .toDate(timeZone)
                                    .toLocaleDateString(undefined, { timeZone })
                                : datePlaceholder}
                            <ChevronDownIcon />
                        </Button>
                    {/snippet}
                </Popover.Trigger>
                <Popover.Content class="w-auto overflow-hidden p-0" align="start">
                    <Calendar
                        type="single"
                        bind:value={selectedDate}
                        onValueChange={() => {
                            open = false;
                        }}
                        captionLayout="dropdown"
                    />
                </Popover.Content>
            </Popover.Root>
        </div>
        <div data-slot="input-time" class="w-full min-[29rem]:w-[16ch] h-max flex flex-col gap-1.5 shrink-0">
            <Label for={`${id}-time`} class="px-1">{timeLabel}</Label>
            <Input
                type="time"
                id={`${id}-time`}
                step={timeStep}
                bind:value={selectedTime}
                class="w-full bg-transparent appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none mt-0! text-base"
            />
        </div>
    </div>
</div>
