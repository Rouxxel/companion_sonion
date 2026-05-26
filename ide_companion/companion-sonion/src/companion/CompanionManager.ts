import * as vscode from 'vscode';
import { Companion } from './Companion';
// Use VS Code workspace fs API to avoid direct node fs dependencies

const STORAGE_KEY = 'companions';
const PROFILES_KEY = 'companion_profiles';

export class CompanionManager {

    private companions: Map<string, Companion> = new Map();
    private storageUri?: vscode.Uri;
    private _onDidChange = new vscode.EventEmitter<void>();
    public readonly onDidChange = this._onDidChange.event;

    constructor(private storage?: vscode.Memento, storageUri?: vscode.Uri) {
        this.storageUri = storageUri;
        if (this.storage) {
            const saved = this.storage.get<Companion[]>(STORAGE_KEY, []);
            saved.forEach(c => this.companions.set(c.id, c));
        }
    }

    private async save() {
        if (!this.storage) return;
        await this.storage.update(STORAGE_KEY, Array.from(this.companions.values()));
        this._onDidChange.fire();
        console.log("Saved companion");
    }

    create(companion: Companion) {
        this.companions.set(companion.id, companion);
        this.save();
        console.log("Created and saved companion");
    }

    update(id: string, data: Partial<Companion>) {
        const c = this.companions.get(id);
        if (!c) return;

        this.companions.set(id, { ...c, ...data });
        this.save();
        console.log("Updated and saved companion");
    }

    delete(id: string) {
        this.companions.delete(id);
        this.save();
        console.log("Deleted companion");
    }

    get(id: string) {
        return this.companions.get(id);
    }

    getAll() {
        return Array.from(this.companions.values());
    }

    // Profiles
    async saveProfile(name: string) {
        if (!this.storage) return;
        const profiles = this.storage.get<Record<string, Companion[]>>(PROFILES_KEY, {});
        profiles[name] = this.getAll();
        await this.storage.update(PROFILES_KEY, profiles);
    }

    listProfiles(): string[] {
        if (!this.storage) return [];
        const profiles = this.storage.get<Record<string, Companion[]>>(PROFILES_KEY, {});
        return Object.keys(profiles);
    }

    async loadProfile(name: string) {
        if (!this.storage) return;
        const profiles = this.storage.get<Record<string, Companion[]>>(PROFILES_KEY, {});
        const arr = profiles[name];
        if (!arr) return;
        this.companions.clear();
        arr.forEach(c => this.companions.set(c.id, c));
        await this.save();
        console.log("Loaded profile");
    }

    async deleteProfile(name: string) {
        if (!this.storage) return;
        const profiles = this.storage.get<Record<string, Companion[]>>(PROFILES_KEY, {});
        delete profiles[name];
        await this.storage.update(PROFILES_KEY, profiles);
        console.log("Deleted profile");
    }

    // Import/export world state
    async exportWorld(targetFsPath: string) {
        const data = JSON.stringify(this.getAll(), null, 2);
        const uri = vscode.Uri.file(targetFsPath);
        const encoded = new TextEncoder().encode(data);
        await vscode.workspace.fs.writeFile(uri, encoded);
    }

    async importWorld(sourceFsPath: string) {
        const uri = vscode.Uri.file(sourceFsPath);
        const bytes = await vscode.workspace.fs.readFile(uri);
        const raw = new TextDecoder().decode(bytes);
        const arr = JSON.parse(raw) as Companion[];
        this.companions.clear();
        arr.forEach(c => this.companions.set(c.id, c));
        await this.save();
        console.log("Imported world");
    }

    // Local asset import (copy into extension storage)
    async importLocalAsset(source: vscode.Uri): Promise<string | undefined> {
        if (!this.storageUri) return undefined;

        const extIndex = source.path.lastIndexOf('.');
        const ext = extIndex !== -1 ? source.path.substring(extIndex) : '';
        const filename = `${Date.now()}${ext}`;
        const targetUri = vscode.Uri.joinPath(this.storageUri, filename);

        await vscode.workspace.fs.copy(source, targetUri, { overwrite: true });

        // return marker that indicates local asset stored in global storage
        console.log("Imported local asset");
        return `local:${filename}`;
    }

    getLocalAssetFsPath(marker: string): vscode.Uri | undefined {
        if (!marker || !marker.startsWith('local:') || !this.storageUri) return undefined;
        const filename = marker.substring('local:'.length);
        console.log("Getting local asset fs path");
        return vscode.Uri.joinPath(this.storageUri, filename);
    }
}
