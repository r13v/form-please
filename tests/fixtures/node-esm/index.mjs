import { createFormKit, fromResource, matchResource } from "form-please"
import { createDefaultSlots } from "form-please/default-slots"
import { createNativeControls } from "form-please/native-controls"
import { nativeFormKit } from "form-please/preset-native"
import { createDefinitionTester } from "form-please/testing"

const schema = {
	"~standard": {
		version: 1,
		vendor: "form-please-smoke",
		validate(value) {
			return { value }
		},
	},
}

const kit = createFormKit({
	controls: createNativeControls(),
	slots: createDefaultSlots(),
})
const definition = kit.defineForm(schema, {
	ui: [{ kind: "field", path: "name", control: "text" }],
})

if (definition.schema !== schema || typeof kit.useForm !== "function") {
	throw new Error("ESM root entry did not expose the form kit")
}
if (typeof createDefaultSlots().Field !== "function") {
	throw new Error("ESM default-slots entry did not initialize")
}
if (typeof createNativeControls().text.component !== "function") {
	throw new Error("ESM native-controls entry did not initialize")
}
if (typeof nativeFormKit.AutoForm !== "function") {
	throw new Error("ESM native preset did not initialize")
}
const tester = createDefinitionTester(definition, { values: { name: "Ada" } })
if (tester.field("name").visible !== true) {
	throw new Error("ESM testing entry did not resolve the definition")
}

const label = fromResource((values) => values.organization, {
	pending: () => "Loading",
	success: ({ value }) => value,
	error: ({ error }) => String(error),
})
if (
	label(
		{ organization: { status: "success", value: "Forms" } },
		{ context: undefined },
	) !== "Forms"
) {
	throw new Error("ESM fromResource returned the wrong branch")
}
if (
	matchResource(
		{ status: "success", value: 42 },
		{ pending: () => 0, success: ({ value }) => value, error: () => -1 },
	) !== 42
) {
	throw new Error("ESM matchResource returned the wrong branch")
}
