package com.personal.workspace.store;

import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Statement;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Repository;

@Repository
public class WorkspaceStore {

    private static final String KEY = "workspace";

    private final ObjectMapper mapper;
    private final String jdbcUrl;

    public WorkspaceStore(ObjectMapper mapper, @Value("${app.database.path:./data/workspace.db}") String databasePath) {
        this.mapper = mapper;
        Path path = Path.of(databasePath).toAbsolutePath();
        try {
            Files.createDirectories(path.getParent());
        } catch (Exception ex) {
            throw new IllegalStateException("Cannot create database directory: " + path.getParent(), ex);
        }
        this.jdbcUrl = "jdbc:sqlite:" + path;
        initialize();
    }

    public synchronized JsonNode load() {
        try (Connection connection = DriverManager.getConnection(jdbcUrl);
             PreparedStatement statement = connection.prepareStatement("select json_data from workspace_documents where doc_key = ?")) {
            statement.setString(1, KEY);
            try (ResultSet rs = statement.executeQuery()) {
                if (rs.next()) {
                    return mapper.readTree(rs.getString(1));
                }
            }
            JsonNode empty = mapper.readTree("{\"notes\":[],\"hosts\":[],\"projects\":[],\"links\":[],\"tags\":[]}");
            save(empty);
            return empty;
        } catch (Exception ex) {
            throw new IllegalStateException("Cannot load workspace data", ex);
        }
    }

    public synchronized void save(JsonNode workspace) {
        try (Connection connection = DriverManager.getConnection(jdbcUrl);
             PreparedStatement statement = connection.prepareStatement(
                     "insert into workspace_documents(doc_key, json_data, updated_at) values(?, ?, datetime('now')) " +
                             "on conflict(doc_key) do update set json_data = excluded.json_data, updated_at = datetime('now')")) {
            statement.setString(1, KEY);
            statement.setString(2, mapper.writeValueAsString(workspace));
            statement.executeUpdate();
        } catch (Exception ex) {
            throw new IllegalStateException("Cannot save workspace data", ex);
        }
    }

    private void initialize() {
        try (Connection connection = DriverManager.getConnection(jdbcUrl);
             Statement statement = connection.createStatement()) {
            statement.executeUpdate("create table if not exists workspace_documents (" +
                    "doc_key text primary key, " +
                    "json_data text not null, " +
                    "updated_at text not null)");
        } catch (Exception ex) {
            throw new IllegalStateException("Cannot initialize workspace database", ex);
        }
    }
}
