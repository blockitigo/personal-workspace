package com.personal.workspace.api;

import com.fasterxml.jackson.databind.JsonNode;
import com.personal.workspace.store.WorkspaceStore;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/workspace")
public class WorkspaceController {

    private final WorkspaceStore workspaceStore;

    public WorkspaceController(WorkspaceStore workspaceStore) {
        this.workspaceStore = workspaceStore;
    }

    @GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
    public JsonNode getWorkspace() {
        return workspaceStore.load();
    }

    @PutMapping(consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public JsonNode saveWorkspace(@RequestBody JsonNode workspace) {
        workspaceStore.save(workspace);
        return workspace;
    }
}
