import { defineConfig } from "vitest/config"

export default defineConfig({
	test: {
		projects: [
			{
				test: {
					name: "react",
					environment: "jsdom",
					include: [
						"src/*.test.{ts,tsx}",
						"src/default-slots/**/*.test.{ts,tsx}",
						"src/devtools/**/*.test.{ts,tsx}",
						"src/history/**/*.test.{ts,tsx}",
						"src/native-controls/**/*.test.{ts,tsx}",
						"src/persistence/**/*.test.{ts,tsx}",
						"src/preset-native/**/*.test.{ts,tsx}",
						"src/preset-mui/**/*.test.{ts,tsx}",
						"src/testing/**/*.test.{ts,tsx}",
					],
					setupFiles: ["tests/setup.ts"],
				},
			},
		],
	},
})
