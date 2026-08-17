const { createFormKit, matchResource } = require("form-please")
const { createDefaultSlots } = require("form-please/default-slots")
const { createNativeControls } = require("form-please/native-controls")
const { nativeFormKit } = require("form-please/preset-native")
const { createDefinitionTester } = require("form-please/testing")

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
	throw new Error("CommonJS root entry did not expose the form kit")
}
if (typeof createDefaultSlots().Field !== "function") {
	throw new Error("CommonJS default-slots entry did not initialize")
}
if (typeof createNativeControls().text.component !== "function") {
	throw new Error("CommonJS native-controls entry did not initialize")
}
if (typeof nativeFormKit.AutoForm !== "function") {
	throw new Error("CommonJS native preset did not initialize")
}
const tester = createDefinitionTester(definition, { values: { name: "Ada" } })
if (tester.field("name").visible !== true) {
	throw new Error("CommonJS testing entry did not resolve the definition")
}
if (
	matchResource(
		{ status: "success", value: 42 },
		{ pending: () => 0, success: ({ value }) => value, error: () => -1 },
	) !== 42
) {
	throw new Error("CommonJS matchResource returned the wrong branch")
}
