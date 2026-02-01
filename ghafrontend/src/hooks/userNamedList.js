import { useCallback, useEffect, useState } from "react";
import { pb } from "../pbClient";

/**
 * useNamedList(collection = 'named_list')
 * - load(): fetches all items (ordered by 'order' if present)
 * - add({ title, value, order })
 * - update(id, { title, value, order })
 * - remove(id)
 */
export function useNamedList(collection = "named_list") {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // listRecords supports filter & sort
      const res = await pb.collection(collection).getFullList({
        sort: "-order", // descending by order; change to 'order' if you want ascending
        expand: "",     // if you have relations
      });
      setItems(res);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [collection]);

  const add = useCallback(async (data) => {
    setLoading(true);
    setError(null);
    try {
      const record = await pb.collection(collection).create(data);
      setItems(prev => [record, ...prev]);
      return record;
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [collection]);

  const update = useCallback(async (id, data) => {
    setLoading(true);
    setError(null);
    try {
      const record = await pb.collection(collection).update(id, data);
      setItems(prev => prev.map(r => (r.id === id ? record : r)));
      return record;
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [collection]);

  const remove = useCallback(async (id) => {
    setLoading(true);
    setError(null);
    try {
      await pb.collection(collection).delete(id);
      setItems(prev => prev.filter(r => r.id !== id));
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [collection]);

  useEffect(() => { load(); }, [load]);

  return { items, loading, error, load, add, update, remove };
}