import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { expect, afterEach } from 'bun:test'
import * as matchers from '@testing-library/jest-dom/matchers'
import { cleanup } from '@testing-library/react'

// Only register if not already registered (to avoid the error I saw earlier)
try {
    GlobalRegistrator.register()
} catch (e) {
    // Already registered, that's fine
}

// matchers can be an object with default property in some environments
const actualMatchers = (matchers as any).default || matchers
expect.extend(actualMatchers as any)

afterEach(cleanup)
