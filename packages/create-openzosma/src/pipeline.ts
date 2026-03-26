import { resolve } from "node:path"
import { intro, log } from "@clack/prompts"
import pc from "picocolors"
import type { SetupConfig } from "./constants.js"
import { configureAuth } from "./steps/auth.js"
import { buildProject } from "./steps/build.js"
import { configureDatabase } from "./steps/database.js"
import { startDocker } from "./steps/docker.js"
import { writeEnvFile } from "./steps/env.js"
import { finish } from "./steps/finish.js"
import { installDependencies } from "./steps/install.js"
import { configureLocalModel } from "./steps/local-model.js"
import { runMigrations } from "./steps/migrate.js"
import { checkPrerequisites } from "./steps/prerequisites.js"
import { setupProject } from "./steps/project.js"
import { configureProvider } from "./steps/provider.js"
import { configureSandbox } from "./steps/sandbox.js"

/**
 * Run the full setup pipeline.
 *
 * @param postClone - If true, skip project clone/download (already in a repo).
 */
export const runPipeline = async (postClone: boolean): Promise<void> => {
	intro(pc.bold("Create OpenZosma"))

	// Step 1: Prerequisites
	const { openshellAvailable } = await checkPrerequisites()

	// Step 2: Project directory (fresh mode only)
	let projectDir: string
	if (postClone) {
		projectDir = resolve(".")
		log.info(`Using existing project at ${pc.dim(projectDir)}`)
	} else {
		projectDir = await setupProject()
	}

	// Step 3: LLM provider
	const providerResult = await configureProvider()

	// Step 3b: Local model config (if selected)
	let localModelConfig: SetupConfig["localModel"]
	if (providerResult.isLocalModel) {
		localModelConfig = await configureLocalModel()
	}

	// Step 4: Database
	const dbConfig = await configureDatabase()

	// Step 5: Sandbox mode
	const sandboxConfig = await configureSandbox(openshellAvailable)

	// Step 6: Auth
	const authConfig = await configureAuth()

	// Assemble config
	const config: SetupConfig = {
		projectDir,
		postClone,
		provider: providerResult.provider,
		providerModel: providerResult.model,
		providerApiKey: providerResult.apiKey,
		localModel: localModelConfig,
		db: dbConfig,
		sandboxMode: sandboxConfig.mode,
		sandboxImage: sandboxConfig.image,
		authSecret: authConfig.authSecret,
		encryptionKey: authConfig.encryptionKey,
		googleOAuth: authConfig.googleOAuth,
		githubOAuth: authConfig.githubOAuth,
	}

	// Step 7: Write .env.local
	writeEnvFile(config)

	// Step 8: Docker services
	try {
		await startDocker(projectDir, config.db.host)
	} catch (err) {
		log.error(`Docker setup failed: ${err instanceof Error ? err.message : String(err)}`)
		log.warn("You can start Docker services manually later with: docker compose up -d")
	}

	// Step 9: Install dependencies
	try {
		await installDependencies(projectDir)
	} catch (err) {
		log.error(`Dependency installation failed: ${err instanceof Error ? err.message : String(err)}`)
		log.warn("Run 'pnpm install' manually to retry.")
		return
	}

	// Step 10: Build (must come before migrations -- @openzosma/logger needs to be compiled)
	try {
		await buildProject(projectDir)
	} catch (err) {
		log.error(`Build failed: ${err instanceof Error ? err.message : String(err)}`)
		log.warn("Run 'pnpm run build' manually to retry.")
		return
	}

	// Step 11: Migrations (requires build output from step 10)
	try {
		await runMigrations(projectDir)
	} catch (err) {
		log.error(`Database migrations failed: ${err instanceof Error ? err.message : String(err)}`)
		log.warn("Ensure PostgreSQL is running and run 'pnpm db:migrate && pnpm db:migrate:auth' manually.")
	}

	// Step 12: Finish
	await finish(projectDir, postClone)
}
