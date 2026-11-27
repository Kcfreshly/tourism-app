"use client";
import {
  tagGroups,
  tagLabels,
  type Tag,
} from "@/modules/catalogue/domain/tags";

// Picks tags from the fixed vocabulary: a dropdown adds one, a chip removes it.
export default function TagPicker({
  value,
  onChange,
  max = 10,
}: {
  value: Tag[];
  onChange: (tags: Tag[]) => void;
  max?: number;
}) {
  return (
    <fieldset className="admin-tags">
      <legend>Tags</legend>
      {value.length > 0 && (
        <ul className="admin-tag-list" aria-label="Selected tags">
          {value.map((tag) => (
            <li key={tag}>
              <button
                type="button"
                className="chip"
                aria-label={`Remove ${tagLabels[tag]}`}
                onClick={() => onChange(value.filter((t) => t !== tag))}
              >
                {tagLabels[tag]} <span aria-hidden="true">×</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <label>
        Add a tag
        <select
          value=""
          disabled={value.length >= max}
          onChange={(e) => {
            const tag = e.target.value as Tag;
            if (tag && !value.includes(tag)) onChange([...value, tag]);
          }}
        >
          <option value="">
            {value.length >= max ? `Up to ${max} tags` : "Choose a tag…"}
          </option>
          {tagGroups.map((group) => (
            <optgroup key={group.label} label={group.label}>
              {Object.entries(group.tags).map(([id, label]) => (
                <option
                  key={id}
                  value={id}
                  disabled={value.includes(id as Tag)}
                >
                  {label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>
    </fieldset>
  );
}
