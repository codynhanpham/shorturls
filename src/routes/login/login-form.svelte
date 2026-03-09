<script lang="ts">
    import { enhance } from '$app/forms';
    import { Link } from '@lucide/svelte';
    import type { HTMLAttributes } from "svelte/elements";
    import {
        FieldGroup,
        Field,
        FieldLabel,
        FieldDescription,
        FieldError,
    } from "$lib/components/ui/field/index.js";
    import { Input } from "$lib/components/ui/input/index.js";
    import { Button } from "$lib/components/ui/button/index.js";
    import { cn, type WithElementRef } from "$lib/utils.js";
    
    let {
        form,
        ref = $bindable(null),
        class: className,
        ...restProps
    }: WithElementRef<HTMLAttributes<HTMLDivElement>> & { form?: any } = $props();
    
    const id = crypto.getRandomValues(new Uint8Array(4)).toString();
</script>

<div
    class={cn("flex flex-col gap-6", className)}
    bind:this={ref}
    {...restProps}
>
    <form method="POST" use:enhance>
        <FieldGroup>
            <div class="flex flex-col items-center gap-1 text-center">
                <a
                    href="/"
                    class="flex flex-col items-center gap-2 font-medium"
                >
                    <div
                        class="flex size-8 items-center justify-center rounded-md"
                    >
                        <Link class="size-7 stroke-[2.5]" />
                    </div>
                    <span class="sr-only">Short URLs favicon</span>
                </a>
                <h1 class="text-xl font-bold">Shorten your URLs</h1>
                <FieldDescription>
                    Admin? Sign in below
                </FieldDescription>
            </div>
            <Field class="gap-1">
                <FieldLabel for="password-{id}" class="font-semibold mb-1">Administrator Password</FieldLabel>
                <Input
                    id="password-{id}"
                    name="password"
                    type="password"
                    placeholder="Enter your password"
                    class="rounded-md"
                    required
                />
                {#if form?.error}
                    <FieldError>{form.error}</FieldError>
                {/if}
            </Field>
            <Field>
                <Button type="submit">Login</Button>
            </Field>
        </FieldGroup>
    </form>
    <FieldDescription class="px-6 text-center">
        Don't have an account? Contact the administrator.
    </FieldDescription>
</div>
