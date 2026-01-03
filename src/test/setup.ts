import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { expect, afterEach } from 'bun:test'
import * as matchers from '@testing-library/jest-dom/matchers'
import { cleanup } from '@testing-library/react'

GlobalRegistrator.register()
expect.extend(matchers as any)

afterEach(cleanup)
