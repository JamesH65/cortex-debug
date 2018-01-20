import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

export class DeprecatedDebugConfigurationProvider implements vscode.DebugConfigurationProvider {
	constructor(private context: vscode.ExtensionContext, private id: string) {}

	resolveDebugConfiguration(folder: vscode.WorkspaceFolder | undefined, config: vscode.DebugConfiguration, token?: vscode.CancellationToken): vscode.ProviderResult<vscode.DebugConfiguration> {
		vscode.window.showWarningMessage(`Your current launch configuration has been deprecated. Please replace "type": "${this.id}-gdb" with "type": "cortex-debug" and "servertype": "${this.id}"`);

		config.type = 'cortex-debug';
		config.servertype = this.id;

		let cp = new CortexDebugConfigurationProvider(this.context);
		return cp.resolveDebugConfiguration(folder, config, token);
	}
}


export class CortexDebugConfigurationProvider implements vscode.DebugConfigurationProvider {
	constructor(private context: vscode.ExtensionContext) {}

	resolveDebugConfiguration(folder: vscode.WorkspaceFolder | undefined, config: vscode.DebugConfiguration, token?: vscode.CancellationToken): vscode.ProviderResult<vscode.DebugConfiguration> {
		if (config.debugger_args && !config.debuggerArgs) {
			config.debuggerArgs = config.debugger_args;
		}
		if (!config.debuggerArgs) { config.debuggerArgs = []; }
		
		let type = config.servertype;

		let validationResponse: string = null;

		if (!config.swoConfig) {
			config.swoConfig = { enabled: false, ports: [], cpuFrequency: 0, swoFrequency: 0 };
		}
		else {
			if (config.swoConfig.ports && !config.swoConfig.decoders) {
				config.swoConfig.decoders = config.swoConfig.ports;
			}
		}
		if (!config.graphConfig) { config.graphConfig = []; }

		switch (type) {
			case "jlink":
				validationResponse = this.verifyJLinkConfiguration(folder, config);
				break;
			case 'openocd':
				validationResponse = this.verifyOpenOCDConfiguration(folder, config);
				break;
			case 'stutil':
				validationResponse = this.verifySTUtilConfiguration(folder, config);
				break;
			case 'pyocd':
				validationResponse = this.verifyPyOCDConfiguration(folder, config);
				break;
			default:
				validationResponse = 'Invalid servertype parameters. The following values are supported: "jlink", "openocd", "stutil", "pyocd"';
				break;
		}

		config.extensionPath = this.context.extensionPath;
		
		if (validationResponse) {
			vscode.window.showErrorMessage(validationResponse);
			return undefined;
		}
		
		let executable: string = (config.executable || "");
		executable = executable.replace(/\$\{\s*workspaceRoot\s*\}/, folder.uri.fsPath);
		let cwd = config.cwd || "${workspaceRoot}";
		cwd = cwd.replace(/\$\{\s*workspaceRoot\s*\}/, folder.uri.fsPath);

		if (!path.isAbsolute(executable)) {
			executable = path.normalize(path.join(cwd, executable));
		}

		if (fs.existsSync(executable)) {
			config.executable = executable;
		}
		else {
			vscode.window.showErrorMessage(`Invalid executable: ${executable} not found.`);
			return undefined;
		}
		
		return config;
	}

	verifyJLinkConfiguration(folder: vscode.WorkspaceFolder | undefined, config: vscode.DebugConfiguration): string {
		if (config.jlinkpath && !config.serverpath) { config.serverpath = config.jlinkpath; }

		if (!config.device) {
			return 'Device Identifier is required for J-Link configurations. Please see https://www.segger.com/downloads/supported-devices.php for supported devices';
		}

		return null;
	}

	verifyOpenOCDConfiguration(folder: vscode.WorkspaceFolder | undefined, config: vscode.DebugConfiguration): string {
		if (config.openOCDPath && !config.serverpath) { config.serverpath = config.openOCDPath; }

		if (!config.configFiles || config.configFiles.length === 0) {
			return 'At least one OpenOCD Configuration File must be specified.';
		}

		return null;
	}

	verifySTUtilConfiguration(folder: vscode.WorkspaceFolder | undefined, config: vscode.DebugConfiguration): string {
		if (config.stutilpath && !config.serverpath) { config.serverpath = config.stutilpath; }

		if (config.swoConfig.enabled) {
			vscode.window.showWarningMessage('SWO support is not available for the st-util server. Disabling.');
			config.swoConfig = { enabled: false, ports: [], cpuFrequency: 0, swoFrequency: 0 };
			config.graphConfig = [];
		}

		return null;
	}

	verifyPyOCDConfiguration(folder: vscode.WorkspaceFolder | undefined, config: vscode.DebugConfiguration): string {
		if (config.pyocdPath && !config.serverpath) { config.serverpath = config.pyocdPath; }
		if (config.board && !config.boardId) { config.boardId = config.board; }
		if (config.target && !config.targetId) { config.targetId = config.target; }

		if (config.swoConfig.enabled) {
			vscode.window.showWarningMessage('SWO support is not available for the PyOCD server. Disabling.');
			config.swoConfig = { enabled: false, ports: [], cpuFrequency: 0, swoFrequency: 0 };
			config.graphConfig = [];
		}

		return null;
	}
}